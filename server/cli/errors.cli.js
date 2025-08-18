// errors.cli.js — Pretty error & helpers

function prettyError(err) {
  // axios error?
  if (err && err.isAxiosError) {
    const url = err.config?.url || '';
    const method = err.config?.method?.toUpperCase?.() || 'GET';
    const status = err.response?.status;
    const data = err.response?.data;

    let msg = `AxiosError:\nURL: ${url}\nMETHOD: ${method}`;
    if (status) msg += `\nSTATUS: ${status}`;
    if (data) {
      const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      msg += `\nRESPONSE: ${body}`;
    }
    return msg;
  }

  // generic
  return (err && (err.stack || err.message)) || String(err);
}

function handleError(err) {
  console.log(prettyError(err));
}

module.exports = { prettyError, handleError };
