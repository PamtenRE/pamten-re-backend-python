// =========================
// JobDiva Suite (Combined)
// =========================
// This single document contains multiple files for a small full-stack workflow:
// 1) Python backend scraper + CSV processor (merge of your two Python scripts)
// 2) React front-end (BillRateMapper) to upload a CSV and assign bill rates client-side
//
// Copy each section into its own file path as labeled below.
// ---------------------------------------------------------

// ================================
// File: backend/jobdiva_suite.py
// ================================

"""
JobDiva Suite
-------------
- Scrape job listings from a live JobDiva session (Selenium attached to existing Chrome)
- Process a CSV to add `relevant_certifications` based on job title

USAGE
-----
# 1) Install deps (Windows example):
python -m pip install selenium pandas python-dateutil

# 2) Launch Chrome with remote debugging:
chrome.exe --remote-debugging-port=9222

# 3) Log into JobDiva in that Chrome window and navigate to your jobs list page.

# 4) Run one of:
python backend/jobdiva_suite.py scrape --pages 200 --from-year 2018 --to-year 2025 \
    --out jobdiva_jobs_raw.csv

python backend/jobdiva_suite.py process --input jobdiva_jobs_raw.csv \
    --output jobdiva_jobs_with_certifications.csv

python backend/jobdiva_suite.py run-all --pages 200 --from-year 2018 --to-year 2025 \
    --output jobdiva_jobs_with_certifications.csv
"""

import argparse
import logging
import time
from datetime import datetime
from typing import List, Dict, Optional

import pandas as pd
from dateutil import parser as dtparser

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException


class JobDivaScraper:
    def __init__(self, from_year: Optional[int] = None, to_year: Optional[int] = None, target_pages: Optional[int] = None, until_end: bool = True, logger: Optional[logging.Logger] = None):
        self.driver = None
        self.jobs_data: List[Dict] = []
        self.from_year = from_year
        self.to_year = to_year
        self.target_pages = target_pages
        self.until_end = until_end
        self.logger = logger or logging.getLogger(__name__)

    # ---------------- Core Setup ----------------
    def setup_driver(self) -> bool:
        """Connect to existing Chrome session (debug port 9222)."""
        options = webdriver.ChromeOptions()
        options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
        try:
            self.driver = webdriver.Chrome(options=options)
            self.logger.info("Connected to existing Chrome session")
            self.logger.info(f"Current URL: {self.driver.current_url}")
            return True
        except Exception as e:
            self.logger.error(f"Connection failed: {e}")
            self.logger.info('Make sure Chrome is running with:  chrome.exe --remote-debugging-port=9222')
            return False

    def wait_for_page_load(self, timeout=12) -> bool:
        try:
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((By.TAG_NAME, "table"))
            )
            return True
        except TimeoutException:
            self.logger.warning(f"Page load timeout after {timeout}s")
            return False

    # ---------------- Utility ----------------
    def _parse_year_safe(self, date_str: str) -> Optional[int]:
        s = (date_str or '').strip()
        if not s:
            return None
        try:
            # Try flexible parsing
            d = dtparser.parse(s, fuzzy=True, dayfirst=False)
            return d.year
        except Exception:
            return None

    def _date_in_range(self, date_str: str) -> bool:
        y = self._parse_year_safe(date_str)
        return (y is not None) and (self.from_year <= y <= self.to_year)

    # ---------------- Extraction ----------------
    def _locate_jobs_table(self):
        tables = self.driver.find_elements(By.TAG_NAME, "table")
        best, best_rows = None, -1
        for t in tables:
            rows = t.find_elements(By.TAG_NAME, "tr")
            if len(rows) > best_rows:
                best, best_rows = t, len(rows)
        return best

    def extract_table_data(self, max_retries=3) -> List[Dict]:
        for attempt in range(max_retries):
            try:
                if not self.wait_for_page_load():
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    return []

                table = self._locate_jobs_table()
                if not table:
                    self.logger.warning("No tables found")
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    return []

                rows = table.find_elements(By.TAG_NAME, "tr")

                # Data rows: 5+ cells
                data_rows = [r for r in rows if len(r.find_elements(By.TAG_NAME, "td")) >= 5]
                self.logger.info(f"Found {len(data_rows)} job rows")

                jobs_on_page: List[Dict] = []
                filtered = 0
                for r in data_rows:
                    tds = r.find_elements(By.TAG_NAME, "td")
                    try:
                        issued_date = tds[0].text.strip() if len(tds) > 0 else ''
                        if not self._date_in_range(issued_date):
                            filtered += 1
                            continue

                        title_cell = tds[1] if len(tds) > 1 else tds[0]
                        links = title_cell.find_elements(By.TAG_NAME, "a")
                        title = title_cell.text.strip()
                        title_link = links[0].get_attribute('href') if links else None

                        job = {
                            'issued_date': issued_date,
                            'title': title,
                            'title_link': title_link,
                            'company': tds[2].text.strip() if len(tds) > 2 else '',
                            'h_manager': tds[3].text.strip() if len(tds) > 3 else '',
                            'location': tds[4].text.strip() if len(tds) > 4 else '',
                            'status': tds[5].text.strip() if len(tds) > 5 else '',
                            'ref_number': tds[6].text.strip() if len(tds) > 6 else '',
                            'jobdiva_number': tds[7].text.strip() if len(tds) > 7 else '',
                            'harvest': tds[8].text.strip() if len(tds) > 8 else '',
                            'priority': tds[9].text.strip() if len(tds) > 9 else '',
                            'max_bill_rate': tds[10].text.strip() if len(tds) > 10 else '',
                            'start_date': tds[11].text.strip() if len(tds) > 11 else '',
                            'submittal_due_date': tds[12].text.strip() if len(tds) > 12 else '',
                            'users': tds[13].text.strip() if len(tds) > 13 else '',
                            'scraped_timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        }
                        jobs_on_page.append(job)
                    except Exception as e:
                        self.logger.debug(f"Row parse error: {e}")
                        continue

                if filtered:
                    self.logger.info(f"(Filtered {filtered} jobs outside {self.from_year}-{self.to_year})")

                self.logger.info(f"Extracted {len(jobs_on_page)} jobs from page")
                return jobs_on_page

            except Exception as e:
                self.logger.warning(f"Extract attempt {attempt+1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
        return []

    def click_next_page(self, max_retries=3) -> bool:
        for attempt in range(max_retries):
            try:
                selectors = [
                    (By.LINK_TEXT, "Next >>"),
                    (By.PARTIAL_LINK_TEXT, "Next"),
                    (By.XPATH, "//a[contains(text(), 'Next')]"),
                    (By.CSS_SELECTOR, "a[href*='next']"),
                ]
                next_el = None
                for by, sel in selectors:
                    els = self.driver.find_elements(by, sel)
                    for el in els:
                        if el.is_displayed() and el.is_enabled():
                            next_el = el
                            break
                    if next_el:
                        break
                if not next_el:
                    self.logger.info("No Next button found; likely last page.")
                    return False

                # Remember a token from first data row to detect content change
                token = None
                try:
                    first = self.driver.find_element(By.CSS_SELECTOR, 'table tr td')
                    token = first.text.strip()
                except Exception:
                    pass

                self.driver.execute_script("arguments[0].scrollIntoView({block:'center'});", next_el)
                time.sleep(0.5)
                self.driver.execute_script("arguments[0].click();", next_el)
                time.sleep(1.5)

                # Wait for table content to change
                def changed(driver):
                    try:
                        first_now = driver.find_element(By.CSS_SELECTOR, 'table tr td').text.strip()
                        return token is None or first_now != token
                    except Exception:
                        return False
                WebDriverWait(self.driver, 10).until(lambda d: changed(d))
                return True
            except (TimeoutException, NoSuchElementException):
                if attempt == 0:
                    self.logger.info("Pagination reached the end.")
                return False
            except Exception as e:
                self.logger.warning(f"Next click attempt {attempt+1} failed: {e}")
                time.sleep(1)
        return False

    def save_incremental(self, page_num: int):
        if page_num % 20 == 0 and self.jobs_data:
            ts = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup = f'jobdiva_backup_page{page_num}_{ts}.csv'
            pd.DataFrame(self.jobs_data).to_csv(backup, index=False, encoding='utf-8')
            self.logger.info(f"Backup saved: {backup} ({len(self.jobs_data)} jobs)")

    def scrape_all_pages(self) -> None:
        page = 1
        start = time.time()
        fails = 0
        while page <= self.target_pages:
            self.logger.info(f"SCRAPING PAGE {page}/{self.target_pages}")
            jobs = self.extract_table_data()
            if not jobs:
                fails += 1
                if fails >= 3:
                    self.logger.error("Too many consecutive failures; stopping.")
                    break
            else:
                fails = 0
                self.jobs_data.extend(jobs)

            self.logger.info(f"Total so far: {len(self.jobs_data)} rows")
            self.save_incremental(page)

            if page >= self.target_pages:
                break
            if not self.click_next_page():
                self.logger.info(f"Stopped at page {page} (no more pages)")
                break
            page += 1

        elapsed = (time.time() - start) / 60.0
        self.logger.info(f"Scraping done. Pages: {page} | Rows: {len(self.jobs_data)} | Time: {elapsed:.1f} min")

    # ---------------- Output ----------------
    def save_csv(self, path: str) -> None:
        if not self.jobs_data:
            self.logger.warning("No data to save.")
            return
        df = pd.DataFrame(self.jobs_data)
        df.to_csv(path, index=False, encoding='utf-8')
        self.logger.info(f"Saved CSV: {path} | rows={len(df)} cols={len(df.columns)}")


# ---------------- CSV Processor (certifications) ----------------

def get_relevant_certifications(title: str) -> str:
    if not title:
        return ''
    t = title.lower()
    certs: List[str] = []

    # Cloud
    if 'aws' in t or 'amazon web services' in t:
        certs += ['AWS Solutions Architect', 'AWS Developer', 'AWS SysOps Administrator']
    if 'azure' in t:
        certs += ['Azure Solutions Architect', 'Azure Administrator', 'Azure Developer']
    if 'gcp' in t or 'google cloud' in t:
        certs += ['Google Cloud Professional Architect', 'Google Cloud Engineer']
    if 'oracle cloud' in t or 'oci' in t:
        certs += ['Oracle Cloud Infrastructure Architect', 'Oracle Cloud Infrastructure Foundations']

    # Data & Analytics
    if 'data engineer' in t or 'etl' in t:
        certs += ['AWS Certified Data Analytics', 'Google Cloud Data Engineer', 'Microsoft Certified: Azure Data Engineer']
    if 'data scientist' in t or 'machine learning' in t or 'ml' in t:
        certs += ['AWS Machine Learning', 'Google Cloud ML Engineer', 'Microsoft Certified: Azure AI Engineer']
    if 'powerbi' in t or 'power bi' in t:
        certs += ['Microsoft Certified: Power BI Data Analyst', 'Microsoft Certified: Data Analyst Associate']
    if 'tableau' in t:
        certs += ['Tableau Desktop Specialist', 'Tableau Certified Data Analyst']

    # Programming
    if 'java' in t:
        certs += ['Oracle Certified Professional Java Programmer', 'Oracle Certified Java Developer']
    if 'python' in t:
        certs += ['PCEP - Python Entry Level', 'PCAP - Python Associate']
    if '.net' in t or 'c#' in t:
        certs += ['Microsoft Certified: Azure Developer Associate', 'MCSD: App Builder']

    # Salesforce
    if 'salesforce' in t:
        if 'architect' in t:
            certs += ['Salesforce Certified Technical Architect', 'Salesforce Certified Application Architect']
        elif 'admin' in t:
            certs += ['Salesforce Certified Administrator', 'Salesforce Certified Advanced Administrator']
        elif 'developer' in t:
            certs += ['Salesforce Certified Platform Developer I', 'Salesforce Certified Platform Developer II']
        else:
            certs += ['Salesforce Certified Administrator', 'Salesforce Certified Platform Developer']

    # SAP
    if 'sap' in t:
        if 'fico' in t:
            certs += ['SAP Certified Application Associate - Financial Accounting', 'SAP S/4HANA Finance Certification']
        elif 'hana' in t:
            certs += ['SAP Certified Technology Associate - SAP HANA', 'SAP S/4HANA Certification']
        else:
            certs += ['SAP Certified Application Associate', 'SAP S/4HANA Certification']

    # Oracle (non-cloud)
    if 'oracle' in t and 'cloud' not in t:
        if 'dba' in t or 'database' in t:
            certs += ['Oracle Database Administrator Certified Professional', 'Oracle Database SQL Certified Associate']
        elif 'integration' in t:
            certs += ['Oracle Integration Cloud Certified Specialist']

    # Networking & Security
    if 'network' in t or '5g' in t or 'ran' in t:
        certs += ['CCNA', 'CCNP', 'CompTIA Network+']
    if 'security' in t or 'cybersecurity' in t:
        certs += ['CISSP', 'CompTIA Security+', 'CEH', 'CISM']

    # DevOps & Infra
    if 'devops' in t or 'sre' in t:
        certs += ['AWS DevOps Engineer', 'Azure DevOps Engineer Expert', 'Certified Kubernetes Administrator']
    if 'kubernetes' in t or 'k8s' in t:
        certs += ['CKA - Certified Kubernetes Administrator', 'CKAD - Certified Kubernetes Application Developer']
    if 'docker' in t or 'container' in t:
        certs += ['Docker Certified Associate', 'CKA - Certified Kubernetes Administrator']

    # PM/Agile
    if 'project manager' in t or ' pm ' in t or 'scrum master' in t:
        certs += ['PMP', 'Certified Scrum Master (CSM)', 'PMI-ACP', 'PRINCE2']
    if 'agile' in t:
        certs += ['PMI-ACP', 'Certified Scrum Master', 'SAFe Agilist']

    # QA
    if 'qa' in t or 'test' in t or 'quality assurance' in t:
        certs += ['ISTQB Certified Tester', 'CSTE - Certified Software Test Engineer']

    # Mainframe
    if 'mainframe' in t or 'cobol' in t:
        certs += ['IBM Certified System Administrator - z/OS', 'IBM Certified Application Developer - COBOL']

    # Web Dev
    if 'drupal' in t:
        certs += ['Acquia Certified Developer', 'Acquia Certified Site Builder']
    if 'react' in t or 'angular' in t or 'vue' in t:
        certs += ['Meta Certified React Developer', 'AWS Certified Developer']
    if 'fullstack' in t or 'full stack' in t:
        certs += ['AWS Certified Developer', 'Microsoft Certified: Azure Developer Associate']

    # Architecture default
    if 'architect' in t and not certs:
        certs += ['TOGAF', 'AWS Solutions Architect Professional', 'Azure Solutions Architect Expert']

    # Sysadmin default
    if ('system admin' in t or 'sysadmin' in t) and not certs:
        certs += ['CompTIA Server+', 'Linux Professional Institute Certification', 'Microsoft Certified: Azure Administrator']

    # Generic developer/engineer fallbacks
    if ('developer' in t or 'engineer' in t or 'programmer' in t) and not certs:
        certs += ['AWS Certified Developer', 'Microsoft Certified: Azure Developer Associate']

    unique = list(dict.fromkeys(certs))[:4]
    return '; '.join(unique)


def process_csv(input_file: str, output_file: str) -> None:
    df = pd.read_csv(input_file, encoding='utf-8')
    if 'title' not in df.columns:
        raise ValueError("Input CSV must contain a 'title' column")
    df['relevant_certifications'] = df['title'].apply(get_relevant_certifications)
    df.to_csv(output_file, index=False, encoding='utf-8')


# ---------------- CLI ----------------

def configure_logging() -> logging.Logger:
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_filename = f'jobdiva_suite_{ts}.log'
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_filename, encoding='utf-8'),
            logging.StreamHandler()
        ]
    )
    logger = logging.getLogger("jobdiva_suite")
    logger.info(f"Logging to {log_filename}")
    return logger


def main():
    parser = argparse.ArgumentParser(description='JobDiva → Excel (no frontend)')
    parser.add_argument('--pages', type=int, default=None, help='Max pages to scrape (ignored if --until-end)')
    parser.add_argument('--until-end', action='store_true', help='Keep clicking Next until the last page (default if no --pages)')
    parser.add_argument('--from-year', type=int, default=None, help='Optional: filter rows by start year (inclusive)')
    parser.add_argument('--to-year', type=int, default=None, help='Optional: filter rows by end year (inclusive)')
    parser.add_argument('--out', type=str, default='jobdiva_jobs_enriched.xlsx')
    args = parser.parse_args()

    logger = configure_logging()

    scraper = JobDivaScraper(
        from_year=args.from_year,
        to_year=args.to_year,
        target_pages=args.pages,
        until_end=(args.until_end or args.pages is None),
        logger=logger,
    )
    if not scraper.setup_driver():
        return

    logger.info("Starting scrape… make sure your JobDiva jobs list is open in the attached Chrome window.")
    start = time.time()
    scraper.scrape(args.pages)

    if not scraper.jobs_data:
        logger.error("No rows scraped—exiting.")
        return

    df = pd.DataFrame(scraper.jobs_data)
    df = enrich_dataframe(df)

    path = save_excel(df, args.out)
    elapsed = (time.time() - start) / 60
    logger.info(f"Done → {path} | rows={len(df)} | time={elapsed:.1f} min")


if __name__ == '__main__':
    main()
