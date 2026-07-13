import { isChatGptShareUrl, getChatGptShareId } from "chatgpt-share-parser";

export function isValidShareUrl(input) {
  return isChatGptShareUrl(input);
}

export { getChatGptShareId };
