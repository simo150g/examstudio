"use strict";

const courseFiles = {
  etl: { name: "ETL Case 1 CSV", file: "Analytics_mindset_case_studies_ETL_Case1.csv" },
  chinook: { name: "Chinook SQLite database", file: "Chinook_Sqlite.sqlite" },
  songs: { name: "CS50 Songs database", file: "songs.db" },
};

const exams = [
  {
    id: "reconcile",
    title: "Reconcile the invoice total",
    tags: "Excel + SQL",
    minutes: 8,
    summary: "Check an Excel import and reconcile invoice headers to line items.",
    questions: [
      {
        dataset: "etl",
        title: "Check the CSV import",
        tutorContext: "CSV fields Ticker, Name, Year and Accounts Receivables. The header defines the expected fields.",
        prompt: "Import the file with comma as the delimiter and respect quoted fields. Compare each data row’s field count with the header. Count the data rows with extra fields, then filter to ticker AAL. Convert its Accounts Receivables values from text to numbers and sum them. Keep every AAL row.",
        checks: [
          { label: "Rows with extra fields", answer: 3, hint: "Inspect the fields to the right of Total Depreciation. Quoted thousands separators should stay inside a cell." },
          { label: "AAL receivables across all years", answer: 5100000000, hint: "Filter by the ticker and check that the three receivables cells are numeric before summing them." },
        ],
        solution: "The AAPL company names contain unquoted commas, producing three rows with nine fields against an eight-field header. AAL rows align with the header. Remove the commas from AAL’s receivables strings and convert them to numbers. Add 1,600,000,000 + 1,800,000,000 + 1,700,000,000.",
      },
      {
        dataset: "chinook",
        title: "Explain a revenue discrepancy",
        tutorContext: "Invoice(InvoiceId, BillingCountry, Total); InvoiceLine(InvoiceId, UnitPrice, Quantity). Several invoice lines can share one invoice ID.",
        prompt: "Use all invoices billed to Brazil. Count invoices in Invoice before joining, then count rows after an inner join to InvoiceLine on InvoiceId. Calculate the correct total from line prices times quantities. Explain why summing Invoice.Total after the join would report a different amount.",
        checks: [
          { label: "Invoice count before joining", answer: 35, hint: "Start with Invoice and filter BillingCountry to Brazil before bringing in line items." },
          { label: "Row count after joining", answer: 190, hint: "Use the joined row count. An invoice can have more than one line." },
          { label: "Correct total to two decimals", answer: 190.10, decimals: 2, hint: "Multiply the unit price by the quantity at line level, then sum. Every line should contribute once.", known: { value: 1677.10, message: "1,677.10 matches SUM(Invoice.Total) after the join. The invoice total is repeated for every matching line." } },
        ],
        explanation: "Why does summing Invoice.Total after the join overstate revenue?",
        rubric: "A good explanation names both grains, identifies repeated invoice totals, and states a valid reconciliation: sum invoice headers once or sum quantity times unit price for each line.",
        solution: "There are 35 invoices and 190 lines. The header total and the line total both equal 190.10 when each is aggregated at its own grain.",
        code: "SELECT COUNT(*), ROUND(SUM(Total), 2)\nFROM Invoice WHERE BillingCountry = 'Brazil';\n\nSELECT COUNT(*), ROUND(SUM(l.UnitPrice * l.Quantity), 2)\nFROM Invoice AS i\nJOIN InvoiceLine AS l ON l.InvoiceId = i.InvoiceId\nWHERE i.BillingCountry = 'Brazil';",
      },
    ],
  },
  {
    id: "units",
    title: "Normalize values before comparing",
    tags: "Excel + SQL",
    minutes: 7,
    summary: "Standardize cash amounts and compare track counts with artist counts.",
    questions: [
      {
        dataset: "etl",
        title: "Standardize cash amounts",
        tutorContext: "CSV fields Ticker, Year and Cash. A K suffix in Cash means thousands.",
        prompt: "Filter to ticker AEHR. In Cash, interpret K as thousands. Convert all three AEHR rows to whole currency units and sum them.",
        checks: [
          { label: "AEHR data rows", answer: 3, hint: "Use an exact filter on Ticker and include every year." },
          { label: "Total cash in whole units", answer: 35500000, hint: "Extract the numeric portion of each value and multiply by 1,000 before summing.", known: { value: 35500, message: "35,500 is the sum in thousands. Multiply by 1,000 to report whole units." } },
        ],
        solution: "AEHR cash is 900 K, 17,800 K and 16,800 K. The total is 35,500 thousand, or 35,500,000 in whole units.",
      },
      {
        dataset: "songs",
        title: "Check the unit of analysis",
        tutorContext: "songs(id, artist_id, energy); artists(id). songs.artist_id references artists.id.",
        prompt: "Use songs with energy of at least 0.8. Count the qualifying songs, count the distinct artists among them and count all artists in the artists table with no qualifying song.",
        checks: [
          { label: "Qualifying songs", answer: 16, hint: "Filter songs on energy >= 0.8 and count rows." },
          { label: "Distinct qualifying artists", answer: 16, hint: "Count distinct artist_id values after filtering. Matching song and artist counts here do not make the two definitions equivalent." },
          { label: "Artists without a qualifying song", answer: 54, hint: "Start from artists and check whether each artist appears in the qualifying set." },
        ],
        solution: "There are 16 qualifying tracks from 16 distinct artists. The artists table contains 70 rows, so 54 artists have no qualifying track.",
        code: "SELECT COUNT(*), COUNT(DISTINCT artist_id)\nFROM songs WHERE energy >= 0.8;\n\nSELECT COUNT(*) FROM artists AS a\nWHERE NOT EXISTS (\n  SELECT 1 FROM songs AS s\n  WHERE s.artist_id = a.id AND s.energy >= 0.8\n);",
      },
    ],
  },
  {
    id: "scope",
    title: "Audit a filtered population",
    tags: "Excel + SQL",
    minutes: 7,
    summary: "Check duplicate company-year records and reconcile a filtered invoice population.",
    questions: [
      {
        dataset: "etl",
        title: "Check the company-year key",
        tutorContext: "CSV fields Ticker, Year and Cash. The requested unit is one record per company-year.",
        prompt: "Filter the CSV to APVO. Count its data rows and unique years. The repeated company-year is an exact duplicate. Sum the cash values once per year, interpreting K as thousands.",
        checks: [
          { label: "APVO data rows before removing duplicates", answer: 4, hint: "Count the rows before changing the file, including the repeated row." },
          { label: "Distinct APVO years", answer: 3, hint: "Check which year occurs twice for the same ticker." },
          { label: "APVO cash after deduplication", answer: 47400000, hint: "Remove the exact duplicate and convert the K suffix to whole units.", known: { value: 78000000, message: "78,000,000 includes the 2018 value twice. Check the rows for APVO in 2018." } },
        ],
        solution: "APVO has four rows for three unique years. The two 2018 rows are identical. Sum 9,700 K, 7,100 K and 30,600 K once each.",
      },
      {
        dataset: "chinook",
        title: "Reconcile a threshold to the full population",
        tutorContext: "Invoice(InvoiceId, BillingCountry, InvoiceDate, Total). Use SQLite date filtering.",
        prompt: "Use Invoice only. Filter to invoices billed to Brazil in calendar year 2012. Count all invoices, then count invoices with Total of at least 5.00. Sum Total for the remaining invoices below 5.00. Keep amounts at two decimals.",
        checks: [
          { label: "Brazil invoices in 2012", answer: 9, hint: "Apply the billing-country filter and use dates from 2012-01-01 up to, but excluding, 2013-01-01." },
          { label: "Invoices at or above 5.00", answer: 4, hint: "Use the same country and period with the threshold condition Total >= 5." },
          { label: "Sum for invoices below 5.00", answer: 10.89, decimals: 2, hint: "Aggregate the complementary group, Total < 5, within the same period and billing country.", known: { value: 53.46, message: "53.46 is the total for the entire Brazil 2012 population. Apply the below-5 filter before summing." } },
        ],
        solution: "The population consists of nine invoices. Four total at least 5.00. The other five sum to 10.89, and the two groups together sum to 53.46.",
        code: "SELECT COUNT(*) AS invoices,\n       SUM(CASE WHEN Total >= 5 THEN 1 ELSE 0 END) AS above_threshold,\n       ROUND(SUM(CASE WHEN Total < 5 THEN Total ELSE 0 END), 2) AS below_total\nFROM Invoice\nWHERE BillingCountry = 'Brazil'\n  AND InvoiceDate >= '2012-01-01' AND InvoiceDate < '2013-01-01';",
      },
    ],
  },
];
