#ifndef CC608READER_H
#define CC608READER_H

#include <cstdint>

#include <QMutex>

#include "cc608decoder.h"

#include "mythtvexp.h"

#define MAXTBUFFER 60
#define MAXOUTBUFFERS (16 + 1)

class CC608Text
{
  public:
    CC608Text(const QString &T, int X, int Y) :
        text(T), x(X), y(Y) {}
    CC608Text(const CC608Text &other) :
        text(other.text), x(other.x), y(other.y) {}
    QString text;
    int x;
    int y;
};

struct TextContainer
{
    int timecode;
    int len;
    unsigned char *buffer;
    char type;
};

class CC608Buffer
{
  public:
   ~CC608Buffer(void) { Clear(); }
    void Clear(void)
    {
        lock.lock();
        vector<CC608Text*>::iterator i = buffers.begin();
        for (; i != buffers.end(); ++i)
        {
            CC608Text *cc = (*i);
            delete cc;
        }
        buffers.clear();
        lock.unlock();
    }

    QMutex lock;
    vector<CC608Text*> buffers;
};

class CC608StateTracker
{
  public:
    CC608StateTracker() = default;
    
    void Clear(void)
    {
        m_outputText = "";
        m_outputCol = 0;
        m_outputRow = 0;
        m_changed = true;
        m_output.Clear();
    }

    QString  m_outputText;
    int      m_outputCol {0};
    int      m_outputRow {0};
    bool     m_changed   {true};
    CC608Buffer m_output;
};

class MythPlayer;

class MTV_PUBLIC CC608Reader : public CC608Input
{
  public:
    explicit CC608Reader(MythPlayer *parent);
   ~CC608Reader();

    void SetTTPageNum(int page)  { m_ccPageNum = page; }
    void SetEnabled(bool enable) { m_enabled = enable; }
    void FlushTxtBuffers(void);
    CC608Buffer *GetOutputText(bool &changed, int &streamIdx);
    CC608Buffer* GetOutputText(bool &changed);
    void SetMode(int mode);
    void ClearBuffers(bool input, bool output, int outputStreamIdx = -1);
    void AddTextData(unsigned char *buf, int len,
                     int64_t timecode, char type) override; // CC608Input
    void TranscodeWriteText(void (*func)
                           (void *, unsigned char *, int, int, int),
                            void * ptr);

  private:
    int Update(unsigned char *inpos);
    void Update608Text(vector<CC608Text*> *ccbuf,
                         int replace = 0, int scroll = 0,
                         bool scroll_prsv = false,
                         int scroll_yoff = 0, int scroll_ymax = 15,
                         int streamIdx = CC_CC1);
    int  NumInputBuffers(bool need_to_lock = true);

    MythPlayer       *m_parent        {nullptr};
    bool              m_enabled       {false};
    // Input buffers
    int               m_readPosition  {0};
    int               m_writePosition {0};
    QMutex            m_inputBufLock;
    int               m_maxTextSize   {0};
    TextContainer     m_inputBuffers[MAXTBUFFER+1] {};
    int               m_ccMode        {CC_CC1};
    int               m_ccPageNum     {0x888};
    // Output buffers
    CC608StateTracker m_state[MAXOUTBUFFERS];
};

#endif // CC608READER_H
