# jobdiva_universal_candidate_scraper.py
"""
Enhanced JobDiva Candidate Scraper with:
- Automatic layout detection
- Dual resume extractor (iframe + ResumeBox)
- Multi-table finder with scoring
- Stale element recovery
- Chrome 141 compatibility
- Manual country selection + auto pagination
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException, StaleElementReferenceException,
    NoSuchElementException, ElementClickInterceptedException
)
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

import time
import re
import logging
from datetime import datetime
import pandas as pd
import os

# ============================================================================
# CONFIGURATION
# ============================================================================
BANNER = "=" * 80
APP_NAME = "JobDiva Universal Candidate Scraper"
VERSION = "v10.0 - Production Ready"

class JobDivaUniversalScraper:
    def __init__(self, max_pages=200, countries=None, deep_scrape=True):
        """
        Initialize the scraper with configuration
        
        Args:
            max_pages: Maximum pages to scrape per country (default: 200)
            countries: List of countries to scrape (default: US, Canada, India)
            deep_scrape: Whether to extract resume details (default: True)
        """
        self.driver = None
        self.all_candidates = []
        self.max_pages = max_pages
        self.countries = countries or ["United States", "Canada", "India"]
        self.deep_scrape = deep_scrape
        self.header_map = {}
        self.candidate_counter = 1
        self.logger = self.setup_logging()
        self.job_titles = self.load_job_titles()
        
    # ========================================================================
    # SETUP & INITIALIZATION
    # ========================================================================
    
    def setup_logging(self):
        """Configure logging with timestamp"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = f"jobdiva_scraper_{timestamp}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler(log_file, encoding="utf-8"),
                logging.StreamHandler()
            ]
        )
        
        logger = logging.getLogger(__name__)
        logger.info(f"Logging initialized: {log_file}")
        return logger
    
    def setup_driver(self):
        """
        Connect to existing Chrome or start new instance
        Priority: Attach to existing Chrome with remote debugging
        """
        # Try to attach to existing Chrome with remote debugging
        try:
            options = webdriver.ChromeOptions()
            options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
            self.driver = webdriver.Chrome(options=options)
            
            # Validate the session is actually working
            try:
                self.driver.current_url  # Test if session is alive
                self.logger.info("SUCCESS: Attached to existing Chrome (remote debugging)")
                return True
            except Exception as e:
                self.logger.warning(f"Session validation failed: {e}")
                self.driver = None
        except Exception as e:
            self.logger.warning(f"Remote attach failed: {e}")
        
        # Fallback: Start new Chrome instance
        try:
            options = webdriver.ChromeOptions()
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--no-sandbox")
            options.add_argument("--start-maximized")
            
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=options)
            self.logger.info("SUCCESS: Started new Chrome instance")
            return True
        except Exception as e:
            self.logger.error(f"ERROR: Failed to start Chrome: {e}")
            return False
    
    def load_job_titles(self):
        """Load job titles from file or use default list"""
        try:
            if os.path.exists("job_titles_masterlist.txt"):
                with open("job_titles_masterlist.txt", "r", encoding="utf-8") as f:
                    titles = [line.strip() for line in f if line.strip()]
                self.logger.info(f"Loaded {len(titles)} job titles from file")
                return titles
        except Exception as e:
            self.logger.warning(f"Could not load titles file: {e}")
        
        # Default job titles
        return [
            "Data Engineer", "Data Analyst", "Business Analyst",
            "Software Engineer", "Python Developer", "Java Developer",
            "QA Engineer", "Project Manager", "Scrum Master",
            "DevOps Engineer", "Cloud Architect", "Database Administrator"
        ]
    
    # ========================================================================
    # TABLE DETECTION & NAVIGATION
    # ========================================================================
    
    def wait_for_table(self, timeout=20):
        """Wait for any table to appear on the page"""
        try:
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((By.TAG_NAME, "table"))
            )
            return True
        except TimeoutException:
            self.logger.warning("Timeout waiting for table")
            return False
    
    def find_all_tables(self):
        """Find all tables and score them to identify the main results table"""
        try:
            tables = self.driver.find_elements(By.TAG_NAME, "table")
        except Exception:
            return []
        
        # Score each table based on multiple heuristics
        scored_tables = []
        preferred_ids = {"results", "myresultsTable", "candidateTable", "searchResultsTable"}
        
        for table in tables:
            score = 0
            try:
                table_id = (table.get_attribute("id") or "").lower()
                table_class = (table.get_attribute("class") or "").lower()
                rows = table.find_elements(By.TAG_NAME, "tr")
                row_count = len(rows)
                
                # ID matching (highest priority)
                if table_id in preferred_ids:
                    score += 100
                
                # Partial ID/class matching
                if "result" in table_id or "result" in table_class:
                    score += 50
                if "candidate" in table_id or "candidate" in table_class:
                    score += 50
                
                # Row count (tables with 5+ rows are likely results)
                if row_count >= 5:
                    score += min(row_count, 100)
                
                # Check for typical column headers
                if row_count > 0:
                    first_row = rows[0]
                    headers = first_row.find_elements(By.TAG_NAME, "th")
                    if headers:
                        header_text = " ".join([h.text.lower() for h in headers])
                        if "candidate" in header_text or "name" in header_text:
                            score += 30
                        if "state" in header_text or "country" in header_text:
                            score += 20
                
                scored_tables.append((score, row_count, table))
            except Exception as e:
                self.logger.debug(f"Error scoring table: {e}")
                continue
        
        # Sort by score (descending), then by row count
        scored_tables.sort(key=lambda x: (-x[0], -x[1]))
        return [t[2] for t in scored_tables]
    
    def get_main_table(self, max_attempts=15):
        """Get the main results table with retry logic"""
        for attempt in range(max_attempts):
            tables = self.find_all_tables()
            if tables:
                return tables[0]
            time.sleep(1.0)  # Increased wait between attempts
        return None
    
    def detect_headers(self, table):
        """Detect and map column headers from table"""
        self.header_map = {}
        
        try:
            # Try to find header row
            rows = table.find_elements(By.TAG_NAME, "tr")
            header_row = None
            
            # Look for <th> elements
            for row in rows:
                ths = row.find_elements(By.TAG_NAME, "th")
                if ths:
                    header_row = row
                    break
            
            # If no <th>, use first row
            if not header_row and rows:
                header_row = rows[0]
            
            if header_row:
                cells = header_row.find_elements(By.XPATH, ".//th|.//td")
                for idx, cell in enumerate(cells):
                    header_text = cell.text.strip().lower()
                    self.header_map[header_text] = idx
                
                self.logger.info(f"Headers detected: {list(self.header_map.keys())}")
        
        except StaleElementReferenceException:
            self.logger.warning("Stale element during header detection, retrying...")
            time.sleep(0.5)
            # Retry once
            table = self.get_main_table(max_attempts=2)
            if table:
                self.detect_headers(table)
    
    # ========================================================================
    # RESUME EXTRACTION (Universal Methods)
    # ========================================================================
    
    def extract_resume_text(self):
        """
        Universal resume extraction supporting multiple layouts:
        1. Resume tab click
        2. Dialog viewers
        3. Nested iframes
        4. ResumeBox div
        5. <pre> and <object> tags
        """
        max_attempts = 3
        
        for attempt in range(1, max_attempts + 1):
            try:
                # Step 1: Click Resume tab if exists
                self._click_resume_tab()
                
                # Step 2: Try dialog extraction
                text = self._extract_from_dialog()
                if text:
                    return self._normalize_text(text)
                
                # Step 3: Try iframe extraction (recursive)
                text = self._extract_from_iframes()
                if text:
                    return self._normalize_text(text)
                
                # Step 4: Try ResumeBox and similar containers
                text = self._extract_from_resume_container()
                if text:
                    return self._normalize_text(text)
                
                # Step 5: Try body text
                text = self._extract_from_body()
                if text:
                    return self._normalize_text(text)
                
                time.sleep(1.0)  # Brief pause before retry
                
            except Exception as e:
                self.logger.warning(f"Resume extract attempt {attempt} failed: {e}")
        
        self.logger.warning("All resume extraction attempts failed")
        return ""
    
    def _click_resume_tab(self):
        """Click the Resume tab if present"""
        try:
            resume_tab = WebDriverWait(self.driver, 5).until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//a[contains(text(), 'Resume') or contains(text(), 'Resume')]")
                )
            )
            self.driver.execute_script("arguments[0].click();", resume_tab)
            time.sleep(1.0)
        except Exception:
            pass  # Tab may not exist
    
    def _extract_from_dialog(self):
        """Extract text from visible dialog viewers"""
        try:
            dialogs = self.driver.find_elements(
                By.XPATH,
                "//div[contains(@class, 'ui-dialog-content') and not(contains(@style, 'display: none'))]"
            )
            for dialog in dialogs:
                text = dialog.text.strip()
                if len(text) > 100:
                    return text
        except Exception:
            pass
        return ""
    
    def _extract_from_iframes(self):
        """Recursively extract text from nested iframes"""
        def recurse_iframes(driver):
            text = ""
            try:
                iframes = driver.find_elements(By.TAG_NAME, "iframe")
                for iframe in iframes:
                    driver.switch_to.frame(iframe)
                    
                    # Try to get body text
                    try:
                        body_text = driver.find_element(By.TAG_NAME, "body").text.strip()
                        if len(body_text) > 100:
                            text += "\n" + body_text
                    except Exception:
                        pass
                    
                    # Recurse
                    text += recurse_iframes(driver)
                    driver.switch_to.parent_frame()
            except Exception:
                try:
                    driver.switch_to.default_content()
                except Exception:
                    pass
            return text
        
        result = recurse_iframes(self.driver)
        self.driver.switch_to.default_content()  # Always return to default
        return result
    
    def _extract_from_resume_container(self):
        """Extract from ResumeBox or similar div containers"""
        # Try various ID/class combinations
        selectors = [
            "#ResumeBox", "#resumeBox", "#resume-box",
            "#resumeContainer", "#candidateResume",
            ".resumeBox", ".resume", ".resume-content",
            "div.resumeBox", "div.resume", "div#resume"
        ]
        
        for selector in selectors:
            try:
                element = self.driver.find_element(By.CSS_SELECTOR, selector)
                text = element.text.strip()
                if len(text) > 100:
                    return text
            except Exception:
                continue
        
        # Try <pre> tag
        try:
            pre = self.driver.find_element(By.TAG_NAME, "pre")
            text = pre.text.strip()
            if len(text) > 100:
                return text
        except Exception:
            pass
        
        # Try <object> tag
        try:
            obj = self.driver.find_element(By.TAG_NAME, "object")
            text = obj.text.strip()
            if len(text) > 100:
                return text
        except Exception:
            pass
        
        return ""
    
    def _extract_from_body(self):
        """Last resort: extract from body"""
        try:
            text = self.driver.find_element(By.TAG_NAME, "body").text
            if len(text.strip()) > 100:
                return text
        except Exception:
            pass
        return ""
    
    def _normalize_text(self, text):
        """Normalize extracted text"""
        text = text.replace("\xa0", " ")
        text = re.sub(r"\s+", " ", text).strip()
        return text
    
    # ========================================================================
    # PARSING & DATA EXTRACTION
    # ========================================================================
    
    def match_job_title(self, resume_text):
        """Match job title from resume text"""
        if not resume_text:
            return ""
        
        clean_text = re.sub(r"[^A-Za-z0-9\s/\-]", " ", resume_text.lower())
        clean_text = re.sub(r"\s+", " ", clean_text)
        
        # Try exact matching first
        for title in self.job_titles:
            pattern = re.escape(title.lower()).replace(r"\ ", r"[\s/\-]+")
            if re.search(pattern, clean_text):
                self.logger.info(f"Title matched: {title}")
                return title
        
        # Fallback: heuristic matching
        snippet = " ".join(resume_text.split()[:150]).lower()
        patterns = [
            r"\b(business|data|software|qa|quality|test|project|product)\s+(analyst|engineer|developer|tester|manager|owner)\b",
            r"\b(python|java|devops|cloud|database)\s+(developer|engineer|architect|administrator)\b",
            r"\b(full\s+stack|backend|frontend|mobile)\s+(developer|engineer)\b"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, snippet)
            if match:
                guessed = match.group(0).title()
                self.logger.info(f"Title guessed: {guessed}")
                return guessed
        
        self.logger.warning("No title found")
        return ""
    
    def extract_experience_years(self, text):
        """Extract years of experience from text"""
        patterns = [
            r"(\d+(?:\.\d+)?)\s*(?:\+)?\s*(years?|yrs?)",
            r"(\d+)\s*(?:\+)?\s*years?\s+of\s+experience",
            r"experience[:\s]+(\d+(?:\.\d+)?)\s*(years?|yrs?)"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text.lower())
            if match:
                return match.group(1)
        
        return ""
    
    def extract_skills(self, text):
        """Extract and deduplicate skills from resume text"""
        pattern = r"(?i)(skills?|technologies|tools|expertise)[:\-]?\s*(.{0,1000})"
        match = re.search(pattern, text)
        
        if not match:
            return ""
        
        skills_block = re.sub(r"[•·;|/\n]+", ", ", match.group(2))
        tokens = [t.strip() for t in skills_block.split(",") if 2 < len(t.strip()) < 60]
        
        # Deduplicate while preserving order
        unique_skills = []
        seen = set()
        for token in tokens:
            token_lower = token.lower()
            if token_lower not in seen:
                seen.add(token_lower)
                unique_skills.append(token)
        
        return ", ".join(unique_skills[:50])  # Limit to 50 skills
    
    # ========================================================================
    # CANDIDATE NAVIGATION
    # ========================================================================
    
    def navigate_to_candidate(self, link_element):
        """Navigate to candidate detail page"""
        original_handles = self.driver.window_handles.copy()
        
        try:
            # Try JavaScript click first (more reliable)
            self.driver.execute_script("arguments[0].click();", link_element)
            time.sleep(1.5)  # Increased wait time
            
            # Check if new tab opened
            current_handles = self.driver.window_handles
            if len(current_handles) > len(original_handles):
                new_handle = [h for h in current_handles if h not in original_handles][0]
                self.driver.switch_to.window(new_handle)
                
                # Wait for page to load
                try:
                    WebDriverWait(self.driver, 10).until(
                        lambda d: d.execute_script("return document.readyState") == "complete"
                    )
                except TimeoutException:
                    pass
                
                return True, True  # Success, new tab
            
            # If same tab, wait for page load
            try:
                WebDriverWait(self.driver, 10).until(
                    lambda d: d.execute_script("return document.readyState") == "complete"
                )
            except TimeoutException:
                pass
            
            return True, False  # Success, same tab
            
        except Exception as e:
            self.logger.warning(f"Navigation failed: {e}")
            return False, False
    
    def return_to_list(self, opened_new_tab):
        """Return to candidate list page"""
        try:
            if opened_new_tab:
                # Close the current tab (candidate detail page)
                self.driver.close()
                self.logger.info("Closed candidate tab")
                
                # CRITICAL: Find the correct tab with the results page
                # Don't just switch to handles[0], find the JobDiva tab
                all_handles = self.driver.window_handles
                results_handle = None
                
                for handle in all_handles:
                    try:
                        self.driver.switch_to.window(handle)
                        current_url = self.driver.current_url
                        
                        # Check if this is a JobDiva page (not Chrome UI)
                        if "jobdiva.com" in current_url.lower():
                            self.logger.info(f"Found JobDiva tab: {current_url}")
                            results_handle = handle
                            break
                    except Exception as e:
                        self.logger.debug(f"Error checking handle: {e}")
                        continue
                
                if not results_handle:
                    # Fallback: use first handle
                    self.logger.warning("Could not find JobDiva tab, using first handle")
                    self.driver.switch_to.window(all_handles[0])
                
                self.logger.info("Switched to main window")
            else:
                # If same tab, navigate back
                self.driver.back()
                self.logger.info("Navigated back in same tab")
            
            # Give the page time to start loading
            time.sleep(1.0)
            
            # Check current state and navigate back to results if needed
            try:
                current_url = self.driver.current_url
                self.logger.info(f"After return, current URL: {current_url}")
                
                # Check if we're on a Chrome internal page or wrong page
                if "chrome://" in current_url or "chrome-extension://" in current_url:
                    self.logger.warning("On Chrome internal page, navigating to results")
                    if hasattr(self, 'results_page_url') and self.results_page_url:
                        self.driver.get(self.results_page_url)
                        time.sleep(2.0)
                        self.logger.info("Navigated to saved results page")
                # If we have a saved results URL and we're not on a results page
                elif hasattr(self, 'results_page_url') and self.results_page_url:
                    if "searchcandidatenewdone" not in current_url.lower() and "searchresult" not in current_url.lower():
                        self.logger.info(f"Not on results page, navigating to: {self.results_page_url}")
                        self.driver.get(self.results_page_url)
                        time.sleep(2.0)
                        self.logger.info("Navigated to saved results page")
            except Exception as e:
                self.logger.warning(f"Could not check/fix URL: {e}")
            
            # Wait for table to reappear
            self.logger.info("Waiting for table to appear...")
            table_found = self.wait_for_table(timeout=15)
            
            if table_found:
                self.logger.info("SUCCESS: Table found")
            else:
                self.logger.error("ERROR: Table NOT found after return")
                # Try refreshing the results page if we have the URL
                if hasattr(self, 'results_page_url') and self.results_page_url:
                    self.logger.info("Attempting to reload results page...")
                    self.driver.get(self.results_page_url)
                    time.sleep(3.0)
                    if self.wait_for_table(timeout=10):
                        self.logger.info("SUCCESS: Table found after reload")
                    else:
                        self.logger.error("ERROR: Still no table after reload")
            
            # Stabilization wait
            time.sleep(1.5)
            
        except Exception as e:
            self.logger.error(f"Return to list error: {e}", exc_info=True)
            # Emergency recovery
            try:
                all_handles = self.driver.window_handles
                for handle in all_handles[1:]:  # Close all except first
                    try:
                        self.driver.switch_to.window(handle)
                        self.driver.close()
                    except:
                        pass
                self.driver.switch_to.window(all_handles[0])
                time.sleep(2.0)
            except Exception:
                pass
    
    # ========================================================================
    # PAGE SCRAPING
    # ========================================================================
    
    def scrape_current_page(self, country, page_num, total_so_far):
        """Scrape all candidates from the current page"""
        table = self.get_main_table()
        if not table:
            self.logger.error("No table found on this page")
            return 0
        
        # Detect headers if not done yet
        if not self.header_map:
            self.detect_headers(table)
        
        # Determine column indices
        name_idx = self._get_column_index(["candidate", "name", "candidate name"], default=1)
        state_idx = self._get_column_index(["state", "province"], default=-1)
        
        scraped_count = 0
        processed_names = set()  # Track which candidates we've already processed
        
        # Keep scraping until we can't find any new candidates
        max_scan_attempts = 50  # Safety limit
        scan_attempt = 0
        
        while scan_attempt < max_scan_attempts:
            scan_attempt += 1
            
            # Get fresh table
            table = self.get_main_table()
            if not table:
                self.logger.warning(f"Table disappeared on scan attempt {scan_attempt}")
                # Try to check what page we're on
                try:
                    current_url = self.driver.current_url
                    page_source_snippet = self.driver.page_source[:500]
                    self.logger.info(f"Current URL: {current_url}")
                    self.logger.info(f"Page source start: {page_source_snippet}")
                except Exception:
                    pass
                
                # Wait a bit and try one more time
                time.sleep(3.0)
                table = self.get_main_table()
                if not table:
                    self.logger.error("Still no table after retry, stopping page scrape")
                    break
            
            try:
                rows = table.find_elements(By.TAG_NAME, "tr")
            except Exception as e:
                self.logger.warning(f"Could not get rows: {e}")
                break
            
            # Find the first unprocessed candidate
            found_candidate = False
            
            for i, row in enumerate(rows):
                try:
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if not cells or len(cells) <= name_idx:
                        continue
                    
                    name = cells[name_idx].text.strip()
                    if not name:
                        continue
                    
                    # Skip if already processed
                    if name in processed_names:
                        continue
                    
                    # Found a new candidate!
                    found_candidate = True
                    processed_names.add(name)
                    
                    state = ""
                    if state_idx >= 0 and len(cells) > state_idx:
                        state = cells[state_idx].text.strip()
                    
                    # Generate unique candidate ID
                    candidate_id = f"CAND-{self.candidate_counter:04d}"
                    self.candidate_counter += 1
                    
                    # Initialize candidate data
                    candidate = {
                        "Candidate_Number": candidate_id,
                        "Candidate_Name": name,
                        "State": state,
                        "Country": country,
                        "Job_Title": "",
                        "Experience_Years": "",
                        "Skills": ""
                    }
                    
                    print(f"\n[{total_so_far + scraped_count + 1}] {name}")
                    
                    # Deep scrape if enabled
                    if self.deep_scrape:
                        try:
                            # Find the link in the current row
                            link_element = None
                            try:
                                link_element = cells[name_idx].find_element(By.TAG_NAME, "a")
                            except NoSuchElementException:
                                self.logger.info(f"No clickable link for {name}, skipping deep scrape")
                                self.all_candidates.append(candidate)
                                scraped_count += 1
                                print(f"  > (no link) | 0 yrs | 0 chars")
                                break  # Break inner loop, continue outer loop
                            
                            # Navigate to candidate page (opens new tab)
                            success, opened_new_tab = self.navigate_to_candidate(link_element)
                            
                            if success:
                                # Extract resume data
                                resume_text = self.extract_resume_text()
                                
                                if resume_text:
                                    candidate["Job_Title"] = self.match_job_title(resume_text)
                                    candidate["Experience_Years"] = self.extract_experience_years(resume_text)
                                    candidate["Skills"] = self.extract_skills(resume_text)
                                
                                # Close new tab and return to list
                                self.return_to_list(opened_new_tab)
                                
                                # Wait for page to stabilize - CRITICAL
                                time.sleep(1.5)
                            
                        except Exception as e:
                            self.logger.warning(f"Deep scrape failed for {name}: {e}")
                            # Emergency recovery: ensure we're back on main window
                            try:
                                # Close any extra tabs
                                while len(self.driver.window_handles) > 1:
                                    self.driver.switch_to.window(self.driver.window_handles[-1])
                                    self.driver.close()
                                # Switch to main window
                                self.driver.switch_to.window(self.driver.window_handles[0])
                                time.sleep(2.0)
                            except Exception:
                                pass
                    
                    self.all_candidates.append(candidate)
                    scraped_count += 1
                    
                    # Log progress
                    print(f"  > {candidate['Job_Title']} | {candidate['Experience_Years']} yrs | {len(candidate['Skills'])} chars")
                    
                    # Break inner loop to rescan table for next candidate
                    break
                    
                except Exception as e:
                    self.logger.debug(f"Error processing row {i}: {e}")
                    continue
            
            # If we didn't find any new candidates, we're done with this page
            if not found_candidate:
                self.logger.info(f"No more new candidates found on page {page_num}")
                break
        
        self.logger.info(
            f"[{country}] Page {page_num}: +{scraped_count} candidates "
            f"(total: {total_so_far + scraped_count})"
        )
        
        print(f"[{country}] Page {page_num}/{self.max_pages} - {total_so_far + scraped_count} candidates total")
        return scraped_count
    
    def _get_column_index(self, possible_names, default=-1):
        """Get column index from possible header names"""
        for name in possible_names:
            if name in self.header_map:
                return self.header_map[name]
        return default
    
    # ========================================================================
    # PAGINATION
    # ========================================================================
    
    def find_next_button(self):
        """Find the Next pagination button using multiple strategies"""
        strategies = [
            # Exact text match
            (By.XPATH, "//a[normalize-space()='Next >>']"),
            (By.XPATH, "//button[normalize-space()='Next >>']"),
            
            # Contains Next
            (By.XPATH, "//a[contains(text(), 'Next')]"),
            (By.XPATH, "//button[contains(text(), 'Next')]"),
            
            # Common IDs
            (By.ID, "gotoNext"),
            (By.ID, "nextPage"),
            
            # Class-based
            (By.CSS_SELECTOR, "a.next-page"),
            (By.CSS_SELECTOR, "button.next-page")
        ]
        
        for by, selector in strategies:
            try:
                elements = self.driver.find_elements(by, selector)
                for elem in elements:
                    if elem.is_displayed() and elem.is_enabled():
                        return elem
            except Exception:
                continue
        
        return None
    
    def click_next_and_wait(self, old_table):
        """Click next button and wait for new page to load"""
        next_btn = self.find_next_button()
        if not next_btn:
            return False
        
        try:
            # Try JavaScript click
            self.driver.execute_script("arguments[0].click();", next_btn)
        except Exception:
            try:
                next_btn.click()
            except Exception:
                return False
        
        # Wait for old table to become stale (indicates page change)
        try:
            WebDriverWait(self.driver, 15).until(EC.staleness_of(old_table))
        except TimeoutException:
            pass
        
        # Wait for new table
        if not self.wait_for_table(timeout=15):
            return False
        
        time.sleep(1.0)  # Additional stabilization
        return True
    
    # ========================================================================
    # COUNTRY PROCESSING
    # ========================================================================
    
    def scrape_country_manual(self, country):
        """
        Scrape a country with manual selection
        User selects country and clicks Look Up, then script auto-paginates
        """
        print(f"\n{'='*80}")
        print(f"COUNTRY: {country}")
        print(f"{'='*80}")
        print(f"\nMANUAL STEPS:")
        print(f"  1. In JobDiva, select '{country}' from the Country dropdown")
        print(f"  2. Click the 'Look Up' button")
        print(f"  3. Wait for results table to appear")
        print(f"  4. Then press Enter here to start auto-pagination")
        print(f"{'='*80}")
        
        input(f"\nPress Enter after selecting '{country}' and clicking 'Look Up'... ")
        
        # Wait for table to load
        if not self.wait_for_table(timeout=25):
            self.logger.error("No results table found")
            print(f"ERROR: No results for {country}")
            return
        
        # CRITICAL: Save the results page URL so we can return to it
        try:
            self.results_page_url = self.driver.current_url
            self.logger.info(f"Saved results page URL: {self.results_page_url}")
        except Exception as e:
            self.logger.warning(f"Could not save results URL: {e}")
            self.results_page_url = None
        
        self.header_map = {}  # Reset headers for new country
        total_candidates = 0
        
        for page in range(1, self.max_pages + 1):
            # Get table before scraping
            table_before = self.get_main_table()
            if not table_before:
                self.logger.error("Could not find table")
                break
            
            # Scrape current page
            count = self.scrape_current_page(country, page, total_candidates)
            total_candidates += count
            
            # Check for next button
            next_btn = self.find_next_button()
            if not next_btn:
                print(f"[{country}] Pagination ended at page {page}")
                break
            
            # Navigate to next page
            if not self.click_next_and_wait(table_before):
                print(f"[{country}] Failed to navigate to next page, stopping")
                break
        
        print(f"\nSUCCESS: {country}: {total_candidates} candidates scraped")
        self.logger.info(f"SUCCESS: {country} complete: {total_candidates} candidates total")
    
    # ========================================================================
    # DATA EXPORT
    # ========================================================================
    
    def save_to_csv(self):
        """Save all candidates to CSV file"""
        if not self.all_candidates:
            print("\nWARNING: No candidates to save")
            return
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"jobdiva_candidates_{timestamp}.csv"
        
        df = pd.DataFrame(self.all_candidates)
        df.to_csv(filename, index=False, encoding="utf-8-sig")
        
        print(f"\nSUCCESS: SAVED {filename}")
        print(f"   Total candidates: {len(self.all_candidates)}")
        self.logger.info(f"Saved {len(self.all_candidates)} candidates to {filename}")
        
        return filename
    
    def close(self):
        """Close the browser"""
        if self.driver:
            self.driver.quit()
            self.logger.info("Browser closed")


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    print(BANNER)
    print(f" {APP_NAME}")
    print(f" {VERSION}")
    print(BANNER)
    
    print("\nSETUP INSTRUCTIONS:")
    print("  1) Launch Chrome with remote debugging:")
    print('     "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\\ChromeDebug"')
    print("  2) Log in to JobDiva in that Chrome window")
    print("  3) Navigate to: Activities > Candidate > Look up a candidate")
    print("  4) KEEP Chrome open and on the candidate lookup page")
    
    print("\nCONFIGURATION:")
    print("  - Countries: United States, Canada, India")
    print("  - Max pages per country: 200")
    print("  - Deep scrape: Enabled (extracts job title, years, skills)")
    
    print("\nWORKFLOW:")
    print("  - You manually select each country and click 'Look Up'")
    print("  - Script automatically paginates through all 200 pages")
    print("  - Extracts: Name, State, Country, Job Title, Years, Skills")
    print(BANNER)
    
    input("\nPress Enter when Chrome is ready and you're on the candidate lookup page... ")
    
    # Initialize scraper
    scraper = JobDivaUniversalScraper(
        max_pages=200,
        countries=["United States", "Canada", "India"],
        deep_scrape=True
    )
    
    try:
        # Setup driver
        if not scraper.setup_driver():
            print("ERROR: Failed to setup Chrome driver")
            print("\nTroubleshooting:")
            print("  - Make sure Chrome is running with: --remote-debugging-port=9222")
            print("  - Close ALL Chrome windows and restart with the debug command")
            print("  - Check that no other program is using port 9222")
            return
        
        # Verify session is working
        try:
            # Find a JobDiva tab if multiple tabs are open
            all_handles = scraper.driver.window_handles
            jobdiva_handle = None
            
            for handle in all_handles:
                try:
                    scraper.driver.switch_to.window(handle)
                    current_url = scraper.driver.current_url
                    if "jobdiva.com" in current_url.lower():
                        jobdiva_handle = handle
                        break
                except Exception:
                    continue
            
            if not jobdiva_handle:
                print("\nWARNING: No JobDiva tab found in the open tabs.")
                print("Please ensure you have a JobDiva tab open.")
                print("Opening a new tab to JobDiva...")
                scraper.driver.switch_to.window(all_handles[0])
                scraper.driver.execute_script("window.open('https://www1.jobdiva.com/new/employers/myactivities/searchcandidatenew.jsp', '_blank');")
                time.sleep(3)
                scraper.driver.switch_to.window(scraper.driver.window_handles[-1])
            
            current_url = scraper.driver.current_url
            print(f"\nSUCCESS: Connected to Chrome")
            print(f"Current page: {current_url}")
            
            # Check if we're on the right page
            if "jobdiva.com" not in current_url.lower():
                print("\nWARNING: Not on JobDiva. Opening JobDiva...")
                scraper.driver.get("https://www1.jobdiva.com/new/employers/myactivities/searchcandidatenew.jsp")
                time.sleep(3)
                current_url = scraper.driver.current_url
                print(f"Navigated to: {current_url}")
            
            if "searchcandidate" not in current_url.lower():
                print("\nWARNING: You don't appear to be on the candidate search page.")
                print("Please navigate to: Activities > Candidate > Look up a candidate")
                input("Press Enter when ready... ")
            
        except Exception as e:
            print(f"\nERROR: Chrome session is not valid: {e}")
            print("\nThe Chrome browser may have been closed or the session expired.")
            print("Please:")
            print("  1. Close this script")
            print("  2. Close ALL Chrome windows")
            print("  3. Restart Chrome with: chrome.exe --remote-debugging-port=9222 --user-data-dir=\"C:\\ChromeDebug\"")
            print("  4. Log in to JobDiva and navigate to candidate lookup")
            print("  5. Run this script again")
            return
        
        # Process each country
        for country in scraper.countries:
            scraper.scrape_country_manual(country)
        
        # Save results
        scraper.save_to_csv()
        
        # Summary
        print("\n" + BANNER)
        print("SCRAPING COMPLETE!")
        print(BANNER)
        
        # Breakdown by country
        for country in scraper.countries:
            count = len([c for c in scraper.all_candidates if c['Country'] == country])
            print(f"  {country}: {count} candidates")
        
        print(f"\n  TOTAL: {len(scraper.all_candidates)} candidates")
        print(BANNER)
        
    except KeyboardInterrupt:
        print("\n\nWARNING: Interrupted by user")
        if scraper.all_candidates:
            print("Saving partial results...")
            scraper.save_to_csv()
    
    except Exception as e:
        scraper.logger.error(f"Unexpected error: {e}", exc_info=True)
        print(f"\nERROR: {e}")
        print("\nIf you see 'invalid session id', the Chrome connection was lost.")
        print("Please restart Chrome with the debug command and try again.")
        if scraper.all_candidates:
            print("\nSaving partial results...")
            scraper.save_to_csv()
    
    finally:
        # Ask before closing browser
        try:
            choice = input("\nClose Chrome browser? (y/n): ").strip().lower()
            if choice == "y":
                scraper.close()
            else:
                print("Browser left open for inspection")
        except:
            print("\nScript ended.")


if __name__ == "__main__":
    main()
