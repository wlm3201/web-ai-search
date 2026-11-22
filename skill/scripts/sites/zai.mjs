export default {
  id: 'zai',
  priority: 11,
  name: 'Z.ai',
  url: 'https://zchat.z.ai/',
  newChatUrl: 'https://zchat.z.ai/',
  minCleanChars: 300,
  clickSequence: [
    { sel: 'button.modelSelectorButton' },
    { text: 'GLM-5.3-Flash' },
    { slider: 'low' },
  ],
};
