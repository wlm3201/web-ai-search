export default {
  id: 'hunyuan',
  priority: 12,
  name: '腾讯混元',
  url: 'https://aistudio.tencent.com/',
  freshClick: true,
  newChatText: ['新建会话', '新对话', '开启新对话', '新建对话'],
  freshInSidebar: true,
  forceWeb: true,
  minCleanChars: 300,
  clickSequence: [
    { sel: 'span.paint-button-value' },
    { text: 'No Think' },
  ],
};
