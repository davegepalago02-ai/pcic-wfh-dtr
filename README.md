# Philippine Crop Insurance Corporation (PCIC) - WFH Attendance & Daily Time Record (DTR) System

A modern, responsive, and secure **Work From Home (WFH) Time In / Time Out** web application tailored for **PCIC** employees and connected directly to **Google Sheets** for real-time cloud attendance logging and Civil Service Commission (CSC Form No. 48) compliance.

---

## 🌟 Key Features

1. **Official PCIC Branding & Modern UI**:
   - Designed with PCIC's emerald and gold corporate color palette.
   - Sleek glassmorphism with instant **Dark Mode / Light Mode** switching.
   - Real-time digital clock synchronized with Philippine Standard Time (PHT / GMT+8).
   - Live work duration stopwatch tracking hours worked since morning clock-in.

2. **Direct Google Sheets Cloud Synchronization**:
   - Records (Time In, Lunch Break, Time Out, Daily Accomplishments, Location) push instantly to your official PCIC Google Spreadsheet.
   - Zero API subscription fees using Google Apps Script Web App.
   - **Offline Resiliency**: If network drops or Google Sheet URL isn't configured yet, entries are automatically cached in `localStorage` and can be synced with 1-click.

3. **Civil Service WFH Compliance (CSC Form No. 48)**:
   - Built-in Daily Accomplishment Report entry (mandatory/recommended on Time Out).
   - One-click **CSC Form No. 48 DTR Generator** formatted for printing and PDF submission.
   - Quick accomplishment insert tags for fast daily task recording.

4. **WFH Verification (Optional)**:
   - Live camera selfie capture with timestamp watermarking.
   - Real-time GPS coordinate tagging for WFH attendance verification.

5. **Audio Feedback**:
   - Zero-dependency Web Audio API synthesizers for pleasant audio chimes on Time In and Time Out.

6. **Data Portability**:
   - 1-click Export to `.CSV` spreadsheet.
   - Search and filter records by date, employee name, or action type.

---

## 🚀 Quick Start Guide (Run Locally)

You can run this web app directly in any modern web browser (Google Chrome, Microsoft Edge, Firefox, Safari):

1. Navigate to:
   ```
   C:\Users\PCIC\.gemini\antigravity-ide\scratch\pcic-wfh-dtr
   ```
2. Double-click **`index.html`** to open it directly in your web browser, or launch it with any local web server.

---

## 📋 2-Minute Google Sheets Setup

Connecting this web app to your own Google Sheet takes less than 2 minutes:

### Step 1: Create the Google Sheet
1. Open [Google Sheets (sheets.new)](https://sheets.new).
2. Name your spreadsheet: **`PCIC WFH Attendance Log`**.

### Step 2: Open Google Apps Script
1. In Google Sheets top menu, click: **Extensions > Apps Script**.
2. Delete any default code in the editor (`Code.gs`).

### Step 3: Paste the Backend Script
1. Open `google-apps-script.js` from this project folder (or click *"Copy Google Apps Script Code"* inside the app's Settings modal).
2. Paste the entire script into `Code.gs`.
3. Click the **Save** (disk) icon.

### Step 4: Deploy as Web App
1. Click the blue **Deploy** button at top right > select **New deployment**.
2. Click the gear icon next to "Select type" and select **Web app**.
3. Configure the deployment:
   - **Description**: `PCIC WFH Attendance API`
   - **Execute as**: `Me (your Google account)`
   - **Who has access**: `Anyone` *(Important: This allows the web app to submit attendance records without requiring complex OAuth logins for each employee)*
4. Click **Deploy**.
5. Grant permissions if prompted by Google.
6. Copy the generated **Web App URL** (e.g. `https://script.google.com/macros/s/AKfycb.../exec`).

### Step 5: Connect in the Web App
1. Open the PCIC WFH Web App (`index.html`).
2. Click the **Gear icon (Settings)** at the top right.
3. Paste your Web App URL into the **Google Apps Script Web App URL** field.
4. Click **Test Connection**, then click **Save & Apply Settings**.

Done! All subsequent Time In and Time Out records will automatically log into your Google Sheet in real-time with automated color coding.

---

## 📁 File Structure

```
pcic-wfh-dtr/
├── index.html               # Main application structure & CSC Form 48 modal
├── style.css                # Master CSS with PCIC theme, dark mode, animations
├── app.js                   # Application logic, sync engine, live clock & audio
├── google-apps-script.js    # Ready-to-deploy Google Apps Script backend (Code.gs)
└── README.md                # Documentation and setup instructions
```

---

## 🏛️ PCIC Regional Offices & Departments Supported
- **Head Office**: Office of the President, Actuarial & Research, Claims & Adjustment, Underwriting, Administrative & Finance (AFD), Information Technology (ITD), Planning & Management (PMD).
- **Regional Offices**: RO I (Ilocos), RO II (Cagayan Valley), RO III (Central Luzon), RO IV (Southern Tagalog), RO V (Bicol), RO VI (Western Visayas), RO VII (Central Visayas), RO VIII (Eastern Visayas), RO IX (Zamboanga), RO X (Northern Mindanao), RO XI (Davao), RO XII (SOCCSKSARGEN).
