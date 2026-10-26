/**
 * ===================================================================
 * PCIC WORK FROM HOME (WFH) DTR - GOOGLE APPS SCRIPT BACKEND
 * ===================================================================
 * 
 * INSTRUCTIONS FOR DEPLOYMENT (Takes less than 2 minutes):
 * 1. Open Google Sheets (https://sheets.new) and name it: "PCIC WFH Attendance Log"
 * 2. In Google Sheets, click: Extensions > Apps Script
 * 3. Delete any default code in Code.gs and paste this ENTIRE file into it.
 * 4. Click the "Save" icon (Floppy disk).
 * 5. Click the blue "Deploy" button at top right > "New deployment"
 * 6. Click the Gear icon (Select type) > Choose "Web app"
 * 7. Fill in the deployment settings:
 *    - Description: "PCIC WFH Attendance API"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (IMPORTANT: This allows the web app to post records without OAuth errors)
 * 8. Click "Deploy" and authorize access if prompted.
 * 9. Copy the "Web App URL" (it looks like: https://script.google.com/macros/s/AKfycb.../exec)
 * 10. Paste that Web App URL into the "Google Sheets Setup" in the PCIC WFH Web App!
 * ===================================================================
 */

// Handle GET requests (Health check and data fetch)
function doGet(e) {
  var action = e.parameter.action;
  
  if (action === "get_records") {
    return getRecentRecords(e.parameter.employeeId);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "PCIC WFH Attendance API is active and ready to log records.",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// Handle POST requests (Clock In / Clock Out submissions)
function doPost(e) {
  try {
    var sheet = getOrCreateLogSheet();
    var data;
    
    // Support both raw JSON post body and form-urlencoded payload
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter;
      }
    } else {
      data = e.parameter;
    }
    
    if (!data) {
      return responseJSON({ status: "error", message: "No data received" }, 400);
    }
    
    // Parse fields
    var now = new Date();
    var dateStr = data.date || Utilities.formatDate(now, "Asia/Manila", "yyyy-MM-dd");
    var timeStr = data.time || Utilities.formatDate(now, "Asia/Manila", "hh:mm:ss a");
    var fullTimestamp = data.timestamp || Utilities.formatDate(now, "Asia/Manila", "yyyy-MM-dd HH:mm:ss");
    var employeeId = data.employeeId || "N/A";
    var employeeName = data.employeeName || "N/A";
    var department = data.department || "N/A";
    var workLocation = data.workLocation || "Home (WFH)";
    var logType = data.logType || "Time In";
    var accomplishments = data.accomplishments || "N/A";
    var gpsCoordinates = data.gpsCoordinates || "N/A";
    var photoNote = data.hasPhoto ? "Photo Attached" : "None";
    
    // Append the row to Google Sheets
    sheet.appendRow([
      fullTimestamp,
      dateStr,
      timeStr,
      employeeId,
      employeeName,
      department,
      logType,
      workLocation,
      accomplishments,
      gpsCoordinates,
      photoNote
    ]);
    
    // Format the newly appended row
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1, 1, 11).setVerticalAlignment("middle");
    
    // Format log type background color for quick visual scan
    var typeCell = sheet.getRange(lastRow, 7);
    if (logType.indexOf("In") !== -1) {
      typeCell.setBackground("#d1fae5").setFontColor("#065f46"); // Light green
    } else if (logType.indexOf("Out") !== -1) {
      typeCell.setBackground("#fee2e2").setFontColor("#991b1b"); // Light red
    } else {
      typeCell.setBackground("#fef3c7").setFontColor("#92400e"); // Amber
    }

    return responseJSON({
      status: "success",
      message: "Attendance recorded successfully in PCIC Google Sheet!",
      row: lastRow,
      record: {
        timestamp: fullTimestamp,
        employeeId: employeeId,
        employeeName: employeeName,
        logType: logType
      }
    });

  } catch (error) {
    return responseJSON({
      status: "error",
      message: error.toString()
    }, 500);
  }
}

// Helper: Ensure the Attendance sheet exists and has stylized headers
function getOrCreateLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "DTR_Logs";
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      "Timestamp",
      "Date",
      "Time",
      "Employee ID",
      "Full Name",
      "Department / Regional Office",
      "Action Type",
      "Work Arrangement",
      "Accomplishments / Remarks",
      "GPS Coordinates",
      "Photo Status"
    ];
    
    sheet.appendRow(headers);
    
    // Style headers: PCIC Green background (#047857), white text, bold
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#047857")
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setFontFamily("Arial")
               .setFontSize(10)
               .setHorizontalAlignment("center")
               .setVerticalAlignment("middle");
               
    sheet.setRowHeight(1, 35);
    sheet.setFrozenRows(1);
    
    // Auto-fit column widths
    for (var col = 1; col <= headers.length; col++) {
      sheet.autoResizeColumn(col);
    }
  }
  
  return sheet;
}

// Fetch recent records for employee verification
function getRecentRecords(filterEmployeeId) {
  var sheet = getOrCreateLogSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return responseJSON({ status: "success", records: [] });
  }
  
  var headers = data[0];
  var records = [];
  
  for (var i = data.length - 1; i >= 1; i--) {
    var row = data[i];
    if (!filterEmployeeId || row[3] == filterEmployeeId) {
      records.push({
        timestamp: row[0],
        date: row[1],
        time: row[2],
        employeeId: row[3],
        employeeName: row[4],
        department: row[5],
        logType: row[6],
        workLocation: row[7],
        accomplishments: row[8],
        gpsCoordinates: row[9]
      });
      if (records.length >= 50) break; // limit to 50 recent
    }
  }
  
  return responseJSON({ status: "success", records: records });
}

// Helper to construct JSON response
function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
