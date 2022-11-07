import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Observable, PartialObserver } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { CaptureCardService } from 'src/app/services/capture-card.service';
import { ChannelService } from 'src/app/services/channel.service';
import { CardAndInput, CaptureCardList, InputGroup } from 'src/app/services/interfaces/capture-card.interface';
import { Channel, FetchChannelsFromSourceRequest, GetChannelInfoListRequest } from 'src/app/services/interfaces/channel.interface';
import { VideoSource, VideoSourceList } from 'src/app/services/interfaces/videosource.interface';
import { SetupService } from 'src/app/services/setup.service';
import { InputConnectionsComponent } from '../input-connections.component';

@Component({
  selector: 'app-iconnection',
  templateUrl: './iconnection.component.html',
  styleUrls: ['./iconnection.component.css']
})
export class IconnectionComponent implements OnInit, AfterViewInit {

  @Input() card!: CardAndInput;
  @Input() cardList!: CaptureCardList;
  // Video Sources Indexed by id
  @Input() videoSourceLookup!: VideoSource[];
  @Input() videoSourceList!: VideoSourceList;
  // parent
  @Input() parentComponent!: InputConnectionsComponent;

  @ViewChild("connform") currentForm!: NgForm;
  // @ViewChild("top") topElement!: ElementRef;

  // List of channels
  allChannels: Channel[] = [];
  sourceChannels: Channel[] = [];
  // List of User Groups filtered
  inputGroups: InputGroup[] = [];
  selectGroups: InputGroup[] = [];

  work = {
    successCount: 0,
    errorCount: 0,
    expectedCount: 0,
    recLimitUpd: false,
    reloadGroups: false,
    // These are flled with the value that would be obtained from CardUtil::IsEncoder
    // and CardUtil::IsUnscanable
    isEncoder: false,
    isUnscanable: false,
    hasTuner: false,
    showPresetTuner: false,
    // For input group
    inputGroupName: "",
    orgInputGroupName: "",
    fetchChannelsDialog: false,
    // 0 = not fetch, 1 = in progress, 2 = success, 3 = fail
    fetchStatus: 0,
    fetchCount: 0,
  };

  orgInputGroupIds: number[] = [];

  fetchMessages = [
    "",
    "settings.iconnection.fetch.inprog",
    "settings.iconnection.fetch.complete",
    "settings.iconnection.fetch.failed",
    // "settings.iconnection.fetch.incompatible"
  ]

  preEncodedTypes = [
    "DVB", "FIREWIRE", "HDHOMERUN", "FREEBOX", "IMPORT", "DEMO",
    "ASI", "CETON", "VBOX", "SATIP"
  ];

  unscanableTypes = [
    "FIREWIRE", "HDPVR", "IMPORT", "DEMO", "GO7007", "MJPEG"
  ];

  hasTunerTypes = [
    "DVB", "HDHOMERUN", "FREEBOX", "CETON", "VBOX", "SATIP"
  ];

  quickTuneValues = [
    { prompt: "settings.iconnection.quicktune.never", value: 0 },
    { prompt: "settings.iconnection.quicktune.livetv", value: 1 },
    { prompt: "settings.iconnection.quicktune.always", value: 2 }
  ];

  constructor(private translate: TranslateService, private channelService: ChannelService,
    private captureCardService: CaptureCardService, private setupService: SetupService) {

    this.quickTuneValues.forEach(
      entry => translate.get(entry.prompt).subscribe(data => entry.prompt = data));

    this.loadChannels();
    this.loadInputGroups();
  }

  loadChannels() {
    const channelRequest: GetChannelInfoListRequest = {
      SourceID: 0,
      ChannelGroupID: 0,
      StartIndex: 0,
      Count: 0,
      OnlyVisible: false,
      Details: true,
      OrderByName: false,
      GroupByCallsign: false,
      OnlyTunable: false
    };
    this.channelService.GetChannelInfoList(channelRequest).subscribe(data => {
      this.allChannels = data.ChannelInfoList.ChannelInfos;
      this.fillChannelList();
    });
  }

  loadInputGroups() {
    this.captureCardService.GetInputGroupList().subscribe(data => {
      this.inputGroups = data.InputGroupList.InputGroups;
      this.inputGroups.forEach(x => {
        if (x.InputGroupName, startWith("user:")) {
          const name = x.InputGroupName.substring(5);
          if (this.selectGroups.findIndex(x => name == x.InputGroupName) == -1)
            this.selectGroups.push({
              CardInputId: 0,
              InputGroupId: x.InputGroupId,
              InputGroupName: name
            });
          if (x.CardInputId == this.card.CardId) {
            if (!this.work.inputGroupName) {
              this.work.inputGroupName = name;
              this.work.orgInputGroupName = name;
            }
            this.orgInputGroupIds.push(x.InputGroupId);
          }
        }
      });
    });

  }

  ngOnInit(): void {
    if (!this.card.InputName || this.card.InputName == "None")
      this.card.InputName = "MPEG2TS";
    this.work.isEncoder = (this.preEncodedTypes.indexOf(this.card.CardType) < 0);
    this.work.isUnscanable = (this.unscanableTypes.indexOf(this.card.CardType) >= 0);
    this.work.hasTuner = (this.unscanableTypes.indexOf(this.card.CardType) >= 0);
    // if (!this.work.isUnscanable)
    //   this.work.fetchStatus = 4;
    if (this.work.isEncoder || this.work.isUnscanable)
      if (this.work.hasTuner || this.card.CardType == "EXTERNAL")
        this.work.showPresetTuner = true;
    let obs = new Observable(x => {
      setTimeout(() => {
        x.next(1);
        x.complete();
      }, 100)
    })
    obs.subscribe(x => {
      if (this.card.DisplayName)
        this.currentForm.form.markAsPristine();
      else {
        this.card.DisplayName = "Input " + this.card.CardId;
        this.currentForm.form.markAsDirty();
      }
    });
  }

  ngAfterViewInit(): void {
    this.setupService.setCurrentForm(this.currentForm);
    // this.topElement.nativeElement.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  fillChannelList(): void {
    this.sourceChannels = this.allChannels.filter(data => data.SourceId == this.card.SourceId);
    if (!this.sourceChannels.find(data => data.ChanNum == this.card.StartChannel))
      this.card.StartChannel = "";
  }

  fetchChannels(): void {
    this.work.fetchChannelsDialog = false;
    let parm: FetchChannelsFromSourceRequest = {
      SourceId: this.card.SourceId,
      CardId: this.card.CardId,
      WaitForFinish: true
    };
    this.work.fetchStatus = 1;
    this.channelService.FetchChannelsFromSource(parm).subscribe({
      next: (x: any) => {
        console.log(x);
        if (x.int > 0)
          this.work.fetchStatus = 2;
        else
          this.work.fetchStatus = 3;
        this.work.fetchCount = x.int;
        this.loadChannels();
      },
      error: (err: any) => {
        console.log("fetchChannels", err);
        this.work.fetchStatus = 3;
        this.work.fetchCount = 0;
      }
    });
  }

  saveObserver: PartialObserver<any> = {
    next: (x: any) => {
      if (x.bool) {
        console.log("saveObserver success", x);
        this.work.successCount++;
        if (this.work.recLimitUpd) {
          if (this.work.successCount == this.work.expectedCount) {
            // Update max recordings after all other updates
            this.captureCardService.SetInputMaxRecordings(this.card.CardId, this.card.RecLimit)
              .subscribe(this.saveObserver);
          }
          else if (this.work.successCount == this.work.expectedCount + 1) {
            // reload cards to get updated list from SetInputMaxRecordings
            this.parentComponent.loadCards(false);
            this.work.recLimitUpd = false;
          }
        }
        if (this.work.successCount == this.work.expectedCount && this.work.reloadGroups) {
          this.loadInputGroups();
          this.work.reloadGroups = false;
        }
      }
      else {
        console.log("saveObserver error", x);
        this.work.errorCount++;
        this.currentForm.form.markAsDirty();
      }
    },
    error: (err: any) => {
      console.log("saveObserver error", err);
      this.work.errorCount++;
      this.currentForm.form.markAsDirty();
    }
  };

  saveForm() {
    this.work.successCount = 0;
    this.work.errorCount = 0;
    this.work.expectedCount = 0;
    let inputGroupId = 0;
    // Changing input group - get the new group id
    if (this.work.inputGroupName != this.work.orgInputGroupName) {
      if (this.work.inputGroupName) {
        this.captureCardService.AddUserInputGroup(this.work.inputGroupName)
          .subscribe({
            next: (x: any) => {
              this.saveCard(x.int);
            },
            error: (err: any) => {
              console.log("saveForm error", err);
              this.work.errorCount++;
              this.currentForm.form.markAsDirty();
            }
          });
      }
      else
        // Special value -1 to indicate existing group is being removed
        this.saveCard(-1);
    }
    else
      this.saveCard(0);
  }

  saveCard(inputGroupId: number) {
    if (inputGroupId != 0)
      this.work.reloadGroups = true;
    // Update device and child devices
    let counter = 0;
    this.work.recLimitUpd = false;
    this.cardList.CaptureCardList.CaptureCards.forEach(entry => {
      if (entry.CardId == this.card.CardId || entry.ParentId == this.card.CardId) {
        this.captureCardService.UpdateCaptureCard(entry.CardId, 'displayname',
          entry.DisplayName = this.card.DisplayName)
          .subscribe(this.saveObserver);
        this.captureCardService.UpdateCaptureCard(entry.CardId, 'sourceid',
          String(entry.SourceId = this.card.SourceId))
          .subscribe(this.saveObserver);
        this.captureCardService.UpdateCaptureCard(entry.CardId, 'quicktune',
          String(entry.Quicktune = this.card.Quicktune))
          .subscribe(this.saveObserver);
        this.captureCardService.UpdateCaptureCard(entry.CardId, 'dishnet_eit',
          (entry.DishnetEIT = this.card.DishnetEIT) ? '1' : '0')
          .subscribe(this.saveObserver);
        if (this.card.StartChannel) {
          this.captureCardService.UpdateCaptureCard(entry.CardId, 'startchan',
            entry.StartChannel = this.card.StartChannel)
            .subscribe(this.saveObserver);
          this.work.expectedCount++
        }
        this.captureCardService.UpdateCaptureCard(entry.CardId, 'recpriority',
          String(entry.RecPriority = this.card.RecPriority))
          .subscribe(this.saveObserver);
        this.captureCardService.UpdateCaptureCard(entry.CardId, 'livetvorder',
          String(entry.LiveTVOrder = this.card.LiveTVOrder))
          .subscribe(this.saveObserver);
        this.captureCardService.UpdateCaptureCard(entry.CardId, 'reclimit',
          String(entry.RecLimit = this.card.RecLimit))
          .subscribe(this.saveObserver);
        // Handle schedgroup and schedorder specially.  If schedgroup is
        // set, schedgroup and schedorder should be false and 0,
        // respectively, for all children.
        if (this.card.SchedGroup && this.card.CardId != entry.CardId) {
          entry.SchedGroup = false;
          entry.SchedOrder = 0;
        }
        else {
          entry.SchedGroup = this.card.SchedGroup;
          entry.SchedOrder = this.card.SchedOrder;
        }
        this.captureCardService.UpdateCaptureCard(entry.CardId, 'schedgroup',
          entry.SchedGroup ? '1' : '0')
          .subscribe(this.saveObserver);
        this.captureCardService.UpdateCaptureCard(entry.CardId, 'schedorder',
          String(entry.SchedOrder))
          .subscribe(this.saveObserver);

        this.work.expectedCount += 9;

        if (inputGroupId != 0) {
          this.orgInputGroupIds.forEach(x => {
            this.captureCardService.UnlinkInputGroup(entry.CardId, x)
              .subscribe(this.saveObserver);
            this.work.expectedCount++;
          });
        }
        if (inputGroupId > 0) {
          this.captureCardService.LinkInputGroup(entry.CardId, inputGroupId)
            .subscribe(this.saveObserver);
          this.work.expectedCount++;
        }
        counter++;
      }
    });
    if (counter != this.card.RecLimit) {
      this.work.recLimitUpd = true;
    }
  }

  showHelp() {
    console.log("show help clicked");
    console.log(this);
  }

}
