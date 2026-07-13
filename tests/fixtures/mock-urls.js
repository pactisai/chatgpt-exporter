export const validUrls = [
  "https://chatgpt.com/share/abc123def456",
  "https://chatgpt.com/share/xyz-789",
  "https://chat.openai.com/share/old-format-id",
];

export const invalidUrls = [
  "",
  "not-a-url",
  "https://google.com",
  "https://chatgpt.com/not-a-share",
  "ftp://chatgpt.com/share/test",
  "http://127.0.0.1:8080/share/test",
  "http://localhost/share/test",
  "http://10.0.0.1/share/test",
];

export const ssrfUrls = [
  "http://127.0.0.1/share/test",
  "http://localhost/share/test",
  "http://[::1]/share/test",
  "http://169.254.169.254/latest/meta-data/",
  "http://10.0.0.1/share/test",
  "http://192.168.1.1/share/test",
];
