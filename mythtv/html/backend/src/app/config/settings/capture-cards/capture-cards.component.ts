import { Component, HostListener, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { CaptureCardService } from 'src/app/services/capture-card.service';
import { CaptureCardList, CardAndInput } from 'src/app/services/interfaces/capture-card.interface';
import { MythService } from 'src/app/services/myth.service';
import { SetupService } from 'src/app/services/setup.service';

interface ddParam {
  name: string,
  code: string
}

@Component({
  selector: 'app-capture-cards',
  templateUrl: './capture-cards.component.html',
  styleUrls: ['./capture-cards.component.css']
})
export class CaptureCardsComponent implements OnInit {

  currentTab: number = -1;
  deletedTab = -1;
  dirtyMessages: string[] = [];
  forms: any[] = [];
  disabledTab: boolean[] = [];
  activeTab: boolean[] = [];
  displayDeleteThis: boolean[] = [];
  dirtyText = 'settings.unsaved';
  warningText = 'settings.warning';
  deletedText = 'settings.common.deleted';
  newText = 'settings.common.new';

  m_hostName: string = ""; // hostname of the backend server
  m_CaptureCardList!: CaptureCardList;
  m_CaptureCardsFiltered!: CardAndInput[];
  m_CaptureCardList$!: Observable<CaptureCardList>;
  displayModal: boolean = false;
  selectedCardType: ddParam = { name: "", code: "" };
  displayDeleteAllonHost: boolean = false;
  displayDeleteAll: boolean = false;
  successCount: number = 0;
  expectedCount = 0;
  errorCount: number = 0;
  deleteAll: boolean = false;

  // TODO: Get this list from backend via a new service to be written
  // Because this list should not contain items excluded from build.
  cardTypes: ddParam[] = [
    { name: "DVB-T/S/C, ATSC or ISDB-T tuner card", code: "DVB" },
    { name: "V4L2 encoder", code: "V4L2ENC" },
    { name: "HD-PVR H.264 encoder", code: "HDPVR" },
    { name: "HDHomeRun networked tuner", code: "HDHOMERUN" },
    { name: "Sat>IP networked tuner", code: "SATIP" },
    { name: "V@Box TV Gateway networked tuner", code: "VBOX" },
    { name: "FireWire cable box", code: "FIREWIRE" },
    { name: "Ceton Cablecard tuner", code: "CETON" },
    { name: "IPTV recorder", code: "FREEBOX" },
    { name: "Analog to MPEG-2 encoder card (PVR-150/250/350, etc)", code: "MPEG" },
    { name: "Analog to MJPEG encoder card (Matrox G200, DC10, etc)", code: "MJPEG" },
    { name: "Analog to MPEG-4 encoder (Plextor ConvertX USB, etc)", code: "GO7007" },
    { name: "Analog capture card", code: "V4L" },
    { name: "DVEO ASI recorder", code: "ASI" },
    { name: "Import test recorder", code: "IMPORT" },
    { name: "Demo test recorder", code: "DEMO" },
    { name: "External (black box) recorder", code: "EXTERNAL" },
  ];

  constructor(private mythService: MythService,
    private captureCardService: CaptureCardService, private setupService: SetupService,
    private translate: TranslateService) {
    this.mythService.GetHostName().subscribe(data => {
      this.m_hostName = data.String;
      this.loadCards(true);
      translate.get(this.dirtyText).subscribe(data => this.dirtyText = data);
      translate.get(this.warningText).subscribe(data => this.warningText = data);
      translate.get(this.deletedText).subscribe(data => this.deletedText = data);
      translate.get(this.newText).subscribe(data => this.newText = data);
    });
  }

  loadCards(doFilter: boolean) {
    // Get for all hosts in case they want to use delete all
    this.m_CaptureCardList$ = this.captureCardService.GetCaptureCardList('', '')
    this.m_CaptureCardList$.subscribe(data => {
      this.m_CaptureCardList = data;
      if (doFilter)
        this.filterCards();
    })
  }

  filterCards() {
    this.m_CaptureCardsFiltered
      = this.m_CaptureCardList.CaptureCardList.CaptureCards.filter
        (x => x.ParentId == 0 && x.HostName == this.m_hostName);
    this.dirtyMessages = [];
    this.forms = [];
    this.disabledTab = [];
    this.activeTab = [];
    this.displayDeleteThis = [];
    for (let x = 0; x < this.m_CaptureCardsFiltered.length; x++) {
      this.dirtyMessages.push('');
      this.forms.push();
      this.disabledTab.push(false);
      this.activeTab.push(false);
      this.displayDeleteThis.push(false);
    }
  }

  ngOnInit(): void {
  }

  onTabOpen(e: { index: number }) {
    // Get rid of successful delete when opening a new tab
    if (this.successCount + this.errorCount >= this.expectedCount) {
      this.errorCount = 0;
      this.successCount = 0;
      this.expectedCount = 0;
    }
    this.showDirty();
    if (typeof this.forms[e.index] == 'undefined')
      this.forms[e.index] = this.setupService.getCurrentForm();
    this.setupService.setCurrentForm(null);
    this.currentTab = e.index;
    console.log("onTabOpen");
    console.log(e);
    // This line removes "Unsaved Changes" from current tab header.
    this.dirtyMessages[this.currentTab] = "";
    // This line supports showing "Unsaved Changes" on current tab header,
    // and you must comment the above line,
    // but the "Unsaved Changes" text does not go away after save, so it
    // is no good until we solve that problem.
    // (<NgForm>this.forms[e.index]).valueChanges!.subscribe(() => this.showDirty())
  }

  onTabClose(e: any) {
    this.showDirty();
    this.currentTab = -1;
  }

  showDirty() {
    if (this.currentTab == -1 || !this.forms[this.currentTab]
      || this.disabledTab[this.currentTab])
      return;
    if ((<NgForm>this.forms[this.currentTab]).dirty)
      this.dirtyMessages[this.currentTab] = this.dirtyText;
    else if (!this.m_CaptureCardsFiltered[this.currentTab].CardId)
      this.dirtyMessages[this.currentTab] = this.newText;
    else
      this.dirtyMessages[this.currentTab] = "";
  }

  newCard() {
    this.displayModal = false;
    let x: CardAndInput = <CardAndInput>{
      CardType: this.selectedCardType.code,
      HostName: this.m_hostName,
      ChannelTimeout: 3000,
      SignalTimeout: 1000
    };
    for (let i = 0; i < this.activeTab.length; i++)
      this.activeTab[i] = false;
    this.dirtyMessages.push(this.newText);
    this.forms.push();
    this.disabledTab.push(false);
    this.activeTab.push(true);
    this.displayDeleteThis.push(false);
    this.m_CaptureCardsFiltered.push(x);
    this.selectedCardType = { name: "", code: "" };
  }

  delObserver = {
    next: (x: any) => {
      if (x.bool) {
        this.successCount++;
        if (this.successCount == this.expectedCount) {
          if (this.deleteAll) {
            this.loadCards(true);
          }
          else {
            if (this.deletedTab > -1) {
              this.dirtyMessages[this.deletedTab] = this.deletedText;
              this.disabledTab[this.deletedTab] = true;
              this.activeTab[this.deletedTab] = false;
              this.deletedTab = -1;
            }
          }
        }
      }
      else {
        this.errorCount++;
        this.deletedTab = -1;
      }
    },
    error: (err: any) => {
      console.error(err);
      this.errorCount++;
    },
  };

  deleteThis(index: number) {
    let cardId = this.m_CaptureCardsFiltered[index].CardId;
    if (!this.deleteAll) {
      // Check if prior is finished by checking counts
      if (this.successCount + this.errorCount < this.expectedCount)
        return;
      this.errorCount = 0;
      this.successCount = 0;
      this.expectedCount = 0;
      this.displayDeleteThis[index] = false;
      // To ensure delObserver flags correct item
      this.deletedTab = index;
    }
    // delete any child cards. This only happens for a card that
    // was added before this session and had children created by the
    // input setup or automatically during recording.
    this.m_CaptureCardList.CaptureCardList.CaptureCards.forEach(card => {
      if (card.ParentId == cardId) {
        console.log("DeleteThis (parent):", card.CardId);
        this.expectedCount++;
        this.captureCardService.DeleteCaptureCard(card.CardId)
          .subscribe(this.delObserver);
      }
    });
    // Delete this card. Needs to be separate in case this card was added
    // during this session, then it would not be in the m_CaptureCardList.
    console.log("DeleteThis:", cardId);
    this.expectedCount++;
    this.captureCardService.DeleteCaptureCard(cardId)
      .subscribe(this.delObserver);
  }

  deleteAllOnHost() {
    // Check if prior is finished by checking counts
    if (this.successCount + this.errorCount < this.expectedCount)
      return;
    this.errorCount = 0;
    this.successCount = 0;
    this.expectedCount = 0;
    this.displayDeleteAllonHost = false;
    this.deletedTab = -1;
    this.deleteAll = true;
    for (let ix = 0; ix < this.m_CaptureCardsFiltered.length; ix++) {
      if (!this.disabledTab[ix] && this.m_CaptureCardsFiltered[ix].CardId)
        this.deleteThis(ix);
    }
  }

  deleteAllOnAllHosts() {
    // Check if prior is finished by checking counts
    if (this.successCount + this.errorCount < this.expectedCount)
      return;
    this.displayDeleteAll = false;
    // delete on this host
    this.deleteAllOnHost();
    // delete on others
    this.m_CaptureCardList.CaptureCardList.CaptureCards.forEach(card => {
      if (card.HostName != this.m_hostName) {
        console.log("DeleteThis (other host):", card.CardId);
        this.expectedCount++;
        this.captureCardService.DeleteCaptureCard(card.CardId)
          .subscribe(this.delObserver);
      }
    });
  }

  confirm(message?: string): Observable<boolean> {
    const confirmation = window.confirm(message);
    return of(confirmation);
  };

  canDeactivate(): Observable<boolean> | boolean {
    if (this.forms[this.currentTab] && (<NgForm>this.forms[this.currentTab]).dirty
      || this.dirtyMessages.find(element => element == this.dirtyText)) {
      return this.confirm(this.warningText);
    }
    return true;
  }

  @HostListener('window:beforeunload', ['$event'])
  onWindowClose(event: any): void {
    if (this.forms[this.currentTab] && (<NgForm>this.forms[this.currentTab]).dirty
      || this.dirtyMessages.find(element => element == this.dirtyText)) {
      event.preventDefault();
      event.returnValue = false;
    }
  }

}