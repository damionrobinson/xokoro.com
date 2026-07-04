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
 */

function doPost(e) {
  var result = { result: 'success' };
  try {
    var data = JSON.parse(e.postData.contents);
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
