export default {
  id: 'kimi',
  priority: 14,
  name: 'Kimi',
  url: 'https://kimi.moonshot.cn/',
  newChatUrl: 'https://www.kimi.com/?chat_enter_method=new_chat',
  minCleanChars: 400,
  sendRetry: true,
  thinkLevel: '标准',
  clickSequence: [
    { sel: '[data-testid="model-select-trigger"]' },
    { sel: 'button.effort-item' },
    { text: '$thinkLevel' },
  ],
};
