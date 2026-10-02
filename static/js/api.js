/**
 * API client module for Visual Cryptography engine.
 */

export async function postForm(url, formData) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    const error = new Error("Could not reach the server. Is it running?");
    error.code = "NETWORK_ERROR";
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const error = new Error("Invalid response format from server.");
    error.code = "PARSE_ERROR";
    throw error;
  }

  if (!response.ok || !data.ok) {
    const msg =
      (data.error && data.error.message) ||
      data.message ||
      (typeof data.error === "string" ? data.error : null) ||
      "An error occurred.";
    const error = new Error(msg);
    error.code = (data.error && data.error.code) || data.code || "ERROR";
    throw error;
  }

  return data;
}
