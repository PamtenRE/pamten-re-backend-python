'''
import docx
import pypdf
import io
from bs4 import BeautifulSoup

# Import our new AI function
from .gemini_utils import structure_text_with_ai # Corrected relative import

def parse_resume_file(file_storage):
    """
    Parses an uploaded file, extracts raw text, and sends it to an AI for structuring.
    
    Args:
        file_storage: The FileStorage object from Flask request.files.

    Returns:
        A dictionary containing the AI-parsed data or an error.
    """
    filename = file_storage.filename
    raw_text = ""

    try:
        print(f"Starting to parse file: {filename}")
        if filename.endswith('.docx'):
            doc = docx.Document(io.BytesIO(file_storage.read()))
            for para in doc.paragraphs:
                raw_text += para.text + '\n'
        
        elif filename.endswith('.pdf'):
            pdf_reader = pypdf.PdfReader(io.BytesIO(file_storage.read()))
            for page in pdf_reader.pages:
                raw_text += page.extract_text() + '\n'
        
        else:
            return {"error": "Unsupported file type. Please upload a .docx or .pdf file."}

        if not raw_text.strip():
            return {"error": "Could not extract any text from the document."}

        print("--- Successfully extracted raw text from resume. ---")
        
        # --- This is the new, live AI call ---
        # Replace the old placeholder data with a call to the AI utility
        print("--- Sending extracted text to AI for structuring... ---")
        structured_data = structure_text_with_ai(raw_text) # Uses the imported function
        print("--- AI processing complete. Returning structured data. ---")
        
        return {"parsedData": structured_data}

    except Exception as e:
        print(f"Error in parse_resume_file: {e}")
        return {"error": f"An error occurred while parsing the file: {e}"}
        '''
import docx
import pypdf
import io
from bs4 import BeautifulSoup

# Absolute import for Render (no leading dot)
from gemini_utils import structure_text_with_ai

def parse_resume_file(file_storage):
    """
    Parses an uploaded file, extracts raw text, and sends it to an AI for structuring.
    
    Args:
        file_storage: The FileStorage object from Flask request.files.

    Returns:
        A dictionary containing the AI-parsed data or an error.
    """
    filename = file_storage.filename
    raw_text = ""

    try:
        print(f"Starting to parse file: {filename}")
        if filename.endswith(".docx"):
            doc = docx.Document(io.BytesIO(file_storage.read()))
            for para in doc.paragraphs:
                raw_text += para.text + "\n"

        elif filename.endswith(".pdf"):
            pdf_reader = pypdf.PdfReader(io.BytesIO(file_storage.read()))
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted:
                    raw_text += extracted + "\n"

        else:
            return {"error": "Unsupported file type. Please upload a .docx or .pdf file."}

        if not raw_text.strip():
            return {"error": "Could not extract any text from the document."}

        print("--- Successfully extracted raw text from resume. ---")
        print("--- Sending extracted text to AI for structuring... ---")

        structured_data = structure_text_with_ai(raw_text)

        print("--- AI processing complete. Returning structured data. ---")
        return {"parsedData": structured_data}

    except Exception as e:
        print(f"Error in parse_resume_file: {e}")
        return {"error": f"An error occurred while parsing the file: {e}"}
