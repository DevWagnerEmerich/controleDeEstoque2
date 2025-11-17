import sys
from lxml import etree
import json

def map_xml_to_dict(element):
    """Recursively converts an XML element and its children to a dictionary."""
    if element is None:
        return None

    # Start with attributes
    result = {f"@{k}": v for k, v in element.attrib.items()}

    # Add text content if present
    if element.text and element.text.strip():
        result["#text"] = element.text.strip()

    # Process children
    children = list(element)
    if children:
        for child in children:
            tag_name = child.tag
            # Remove namespace prefix if present
            if '}' in tag_name:
                tag_name = tag_name.split('}', 1)[1]

            child_dict = map_xml_to_dict(child)

            if tag_name in result:
                # If tag already exists, convert to list
                if not isinstance(result[tag_name], list):
                    result[tag_name] = [result[tag_name]]
                result[tag_name].append(child_dict)
            else:
                result[tag_name] = child_dict
    
    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python xml_mapper.py <xml_file_path>")
        sys.exit(1)

    xml_file_path = sys.argv[1]

    try:
        with open(xml_file_path, 'rb') as f:
            xml_content = f.read()
        
        root = etree.fromstring(xml_content)
        
        # Remove namespace from root tag for cleaner output
        root_tag = root.tag
        if '}' in root_tag:
            root_tag = root_tag.split('}', 1)[1]

        mapped_data = {root_tag: map_xml_to_dict(root)}
        
        print(json.dumps(mapped_data, indent=2, ensure_ascii=False))

    except etree.XMLSyntaxError as e:
        print(f"Error parsing XML: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print(f"Error: File not found at {xml_file_path}")
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        sys.exit(1)