# ExamStudio

A practice site for Data Analytics in Accounting. Choose a test or let the site
choose one. Download its course files individually or as one ZIP, then start
the timer when ready. After submission, check your score and the first
checkpoint that didn't match. The written explanation uses self-assessment.

## Public practice site

- [Play ExamStudio](https://simo150g.github.io/examstudio/)
- [Source repository](https://github.com/simo150g/examstudio)

The GitHub Pages edition includes course hints during the exam and in review.
Use the local server below for live Gemini replies.

## Run locally with Gemini

1. Get an authorization API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. In the extracted `ExamStudio` directory, run `python3 serve.py`.
3. Paste the key when the terminal prompts for it. The input is hidden.
4. Open [http://127.0.0.1:8765](http://127.0.0.1:8765) and start an exam.

The server uses `GEMINI_API_KEY` if it is already set. Use the hidden terminal
prompt for local practice. The key stays in the local server process and is
sent as an HTTPS request header to the Gemini API. Keep keys out of source
code, published files, and Git history. Press Enter without a key to
practise with the numeric feedback only. Opening `index.html` directly provides the same course hints as GitHub Pages.

If Gemini returns a temporary server error, ExamStudio tries the alternate
Flash-Lite model once. If the request still fails, the page shows the HTTP
status. Terminal logs the model and HTTP status for failed Gemini calls.
If a request fails, the page also shows a labeled course hint for the first
unfinished checkpoint during the exam or the first missed checkpoint in review.
The course hint comes from the exercise material and follows no API call of its own.

## AI hints during an exam and after submission

Open **Get an AI hint**, describe your question or attempt, and select
**Ask Gemini** to see the reply underneath. The timer continues. Gemini
receives your message, the exercise and the relevant fields. Once submitted,
a new request can also include the first missed checkpoint. The model is
asked to provide one hint and a check to try yourself. The numerical grade
and worked solution come from the verified course data.

GitHub Pages serves the static practice site. `serve.py` provides the local Gemini API connection.

## Course files

The files in `data/` match the originals in the lecturer's assignment folder byte for byte. The three exam ZIPs contain the same files as the individual links.

| Download | Case in the supplied materials |
| --- | --- |
| `Analytics_mindset_case_studies_ETL_Case1.csv` | Excel part 2, ETL, Case 1 |
| `Chinook_Sqlite.sqlite` | SQL part 1, PwC assignment |
| `songs.db` | SQL part 1, CS50 Songs |

## Submission paragraphs

**Added functionality.** ExamStudio uses the intermediate results students submit to identify the first calculation that differs, explain a likely cause where the result matches a known error, and let students check a revised value before opening the worked solution. I observed that the lecturer’s E047 exam provides prerequisites and optional AI help; the added review uses the student’s actual results to locate the problem. In the Brazil invoice exercise, 35 invoice headers become 190 rows after the join. If a student gets both counts right and reports 1,677.10, the site shows that this amount matches the total when each invoice header is counted once per line. The student can correct their calculation and check 190.10 while preserving their original exam score. This gives them a concrete way to practise verifying the level of aggregation, a control they can apply in other reconciliation work. The examples below verify the diagnosis and the correction step. A study with students would be needed to measure learning effects.

**Difficulty of the starting materials.** The course materials include a CSV with unquoted commas in company names, amounts expressed in different units and an exact duplicate company-year, plus SQLite files with different tables and units of analysis. The practice questions must stay faithful to those files and still have unambiguous answers. For example, joining an invoice header to its lines is technically valid, but summing the header total afterwards can produce a plausible, incorrect revenue figure. This assignment therefore requires both building the exam interface and auditing the source files to define verifiable exercises, anticipate plausible mistakes, and explain their effects in an accounting context.

## Reproduce the diagnosis

Choose **Reconcile the invoice total** and start the exam. In the SQL question,
submit 35 invoices, 190 joined rows, and 1,677.10 as the total. The review marks
the total as the first missed checkpoint. Enter 190.10 in the revised-answer
field and check it. The original score is preserved. Open the worked solution
to see both reference queries and the expected answers.

The diagnosis can be verified independently in the supplied Chinook database:

```sql
SELECT COUNT(*) AS invoices, ROUND(SUM(Total), 2) AS header_total
FROM Invoice
WHERE BillingCountry = 'Brazil';

SELECT COUNT(*) AS joined_rows,
       ROUND(SUM(i.Total), 2) AS repeated_header_total,
       ROUND(SUM(l.UnitPrice * l.Quantity), 2) AS line_total
FROM Invoice AS i
JOIN InvoiceLine AS l ON l.InvoiceId = i.InvoiceId
WHERE i.BillingCountry = 'Brazil';
```

The source returns 35 invoices totalling 190.10, then 190 joined rows with
1,677.10 when header totals repeat and 190.10 when line amounts are summed.
The same feedback mechanism also recognizes an amount left in thousands and
an exact duplicate included twice in the supplied ETL CSV.

## Verification

Independently checked all 16 numeric answers from the original course files,
tested both SQLite databases, and compared the contents of all three ZIPs
with the originals. Checked timer expiry, random selection, and review
behavior. Confirmed that Gemini replied beneath an exercise in a live Chrome
test.
