/**
 * Xokoro.com — form intake script
 *
 * Receives JSON POSTs from the newsletter popup and the About page contact
 * form (both on xokoro.com) and appends a row to the matching tab in this
 * spreadsheet, creating the tab with headers on first use if needed.
 *
 * Deploy this as a Web App (Deploy > New deployment > Web app), execute as
 * "Me", access "Anyone". Copy the resulting /exec URL and give it to Claude
 * (or paste it into assets/js/site.js yourself) to finish wiring the site.
 *
 * Every submission must include a fresh reCAPTCHA v3 token, verified against
 * Google before anything gets written. This is the actual security boundary —
 * the honeypot/timing checks in the site's own JS only stop bots that load
 * the page; this stops anyone posting straight to this URL. Get your keys at
 * google.com/recaptcha/admin/create (type: v3) and paste the secret below.
 */

var RECAPTCHA_SECRET_KEY = '6Lf280QtAAAAALEBwqJYZ7HwCqvhZ21qWp1jB0sc';
var RECAPTCHA_MIN_SCORE = 0.5; // v3 scores range 0 (bot) to 1 (human); 0.5 is Google's own suggested default

function doPost(e) {
  var result = { result: 'success' };
  try {
    var data = JSON.parse(e.postData.contents);

    var check = verifyRecaptcha(data.recaptchaToken, data.formType);
    if (!check.ok) {
      return ContentService.createTextOutput(JSON.stringify({ result: 'rejected', reason: check.reason }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.formType === 'contact') {
      appendRow(ss, 'Requests',
        ['Timestamp', 'Type', 'Name', 'Email', 'Message'],
        [new Date(), data.type || '', data.name || '', data.email || '', data.message || '']
      );
      // Optional: uncomment and set your email to get notified of new enquiries.
      // MailApp.sendEmail('you@example.com', 'New Xokoro enquiry',
      //   (data.name || '') + ' <' + (data.email || '') + '>\n\n' + (data.message || ''));
    } else {
      appendRow(ss, 'Subscribers',
        ['Timestamp', 'Name', 'Email', 'Location', 'Browser', 'Device'],
        [new Date(), data.name || '', data.email || '', data.location || '', data.browser || '', data.device || '']
      );
    }
  } catch (err) {
    result = { result: 'error', message: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Verifies a reCAPTCHA v3 token with Google's siteverify endpoint.
 * Returns { ok: true } or { ok: false, reason: '...' }.
 */
function verifyRecaptcha(token, expectedAction) {
  if (!token) return { ok: false, reason: 'missing token' };

  var response = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'post',
    payload: {
      secret: RECAPTCHA_SECRET_KEY,
      response: token
    },
    muteHttpExceptions: true
  });
  var json = JSON.parse(response.getContentText());

  if (!json.success) return { ok: false, reason: 'verification failed' };
  if (expectedAction && json.action && json.action !== expectedAction) {
    return { ok: false, reason: 'action mismatch' };
  }
  if (typeof json.score === 'number' && json.score < RECAPTCHA_MIN_SCORE) {
    return { ok: false, reason: 'low score (' + json.score + ')' };
  }
  return { ok: true };
}

function appendRow(ss, sheetName, headerRow, valuesRow) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headerRow);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headerRow);
  }
  sheet.appendRow(valuesRow);
}
