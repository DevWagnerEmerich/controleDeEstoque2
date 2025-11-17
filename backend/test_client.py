import requests
import sys
import json

def test_upload(file_path):
    """
    Sends a PDF file to the running FastAPI server and prints the response.
    """
    url = "http://127.0.0.1:8000/upload/"
    try:
        with open(file_path, "rb") as f:
            files = {"file": (file_path, f, "application/pdf")}
            headers = {"Authorization": "secret"}
            response = requests.post(url, files=files, headers=headers)
        
        response.raise_for_status() # Raise an exception for bad status codes
        
        # Print the JSON response pretty
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))

    except requests.exceptions.RequestException as e:
        print(f"Error connecting to the server: {e}")
    except FileNotFoundError:
        print(f"Error: File not found at {file_path}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_upload(sys.argv[1])
    else:
        print("Usage: python test_client.py <path_to_pdf>")
