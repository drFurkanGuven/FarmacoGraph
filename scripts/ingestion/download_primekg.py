#!/usr/bin/env python3
"""
PrimeKG Downloader
Downloads the PrimeKG dataset from Harvard Dataverse or Hugging Face.

PrimeKG: Precision Medicine Knowledge Graph
- ~129,375 nodes across 10 biological scales
- ~4,050,000 relationships (edges) across 29 categories

Sources:
- Harvard Dataverse: https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/IXA7BM
- Hugging Face: mims-harvard/PrimeKG

Usage:
    python scripts/ingestion/download_primekg.py [--source harvard|huggingface] [--output data/primekg/]
"""

import argparse
import os
import sys
from pathlib import Path
import requests
from tqdm import tqdm

# Harvard Dataverse API endpoint
HARVARD_DATAVERSE_API = "https://dataverse.harvard.edu/api"
HARVARD_DATASET_ID = "doi:10.7910/DVN/IXA7BM"

# Hugging Face dataset
HF_DATASET_ID = "mims-harvard/PrimeKG"

# Default output directory
DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "primekg"


def download_with_progress(url: str, output_path: Path, desc: str = "Downloading") -> bool:
    """Download file with progress bar."""
    try:
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        
        with open(output_path, 'wb') as f:
            with tqdm(total=total_size, unit='iB', unit_scale=True, desc=desc) as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        pbar.update(len(chunk))
        
        print(f"✓ Downloaded to: {output_path}")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"✗ Download failed: {e}")
        return False


def get_harvard_dataverse_files() -> list[dict]:
    """Get list of files from Harvard Dataverse dataset."""
    url = f"{HARVARD_DATAVERSE_API}/datasets/:persistentId"
    params = {"persistentId": HARVARD_DATASET_ID}
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        files = data.get("data", {}).get("latestVersion", {}).get("files", [])
        return files
        
    except requests.exceptions.RequestException as e:
        print(f"✗ Failed to fetch dataset metadata: {e}")
        return []


def download_from_harvard(output_dir: Path) -> bool:
    """Download PrimeKG from Harvard Dataverse."""
    print("=" * 60)
    print("Downloading PrimeKG from Harvard Dataverse")
    print("=" * 60)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Get file list
    print("\nFetching dataset metadata...")
    files = get_harvard_dataverse_files()
    
    if not files:
        print("✗ No files found in dataset")
        return False
    
    print(f"Found {len(files)} files in dataset:")
    for f in files:
        filename = f.get("dataFile", {}).get("name", "unknown")
        size_mb = f.get("dataFile", {}).get("filesize", 0) / (1024 * 1024)
        print(f"  - {filename} ({size_mb:.1f} MB)")
    
    # Download main KG file (kg.csv)
    kg_file = None
    for f in files:
        filename = f.get("dataFile", {}).get("name", "")
        if "kg.csv" in filename or "primekg" in filename.lower():
            kg_file = f
            break
    
    if not kg_file:
        print("✗ kg.csv not found in dataset")
        return False
    
    file_id = kg_file.get("dataFile", {}).get("id")
    filename = kg_file.get("dataFile", {}).get("name", "kg.csv")
    
    download_url = f"{HARVARD_DATAVERSE_API}/access/datafile/{file_id}"
    output_path = output_dir / filename
    
    if output_path.exists():
        print(f"\n✓ File already exists: {output_path}")
        return True
    
    print(f"\nDownloading {filename}...")
    return download_with_progress(download_url, output_path, desc=filename)


def download_from_huggingface(output_dir: Path) -> bool:
    """Download PrimeKG from Hugging Face."""
    print("=" * 60)
    print("Downloading PrimeKG from Hugging Face")
    print("=" * 60)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Direct download URL for kg.csv
    download_url = f"https://huggingface.co/datasets/{HF_DATASET_ID}/resolve/main/kg.csv"
    output_path = output_dir / "kg.csv"
    
    if output_path.exists():
        print(f"\n✓ File already exists: {output_path}")
        return True
    
    print(f"\nDownloading kg.csv from {HF_DATASET_ID}...")
    return download_with_progress(download_url, output_path, desc="kg.csv")


def main():
    parser = argparse.ArgumentParser(description="Download PrimeKG dataset")
    parser.add_argument(
        "--source",
        choices=["harvard", "huggingface"],
        default="huggingface",
        help="Download source (default: huggingface)"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})"
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("PrimeKG Downloader")
    print("=" * 60)
    print(f"Source: {args.source}")
    print(f"Output: {args.output}")
    print()
    
    if args.source == "harvard":
        success = download_from_harvard(args.output)
    else:
        success = download_from_huggingface(args.output)
    
    if success:
        print("\n" + "=" * 60)
        print("✓ Download complete!")
        print("=" * 60)
        print(f"\nNext step: Run parse_primekg.py to process the data")
        print(f"  python scripts/ingestion/parse_primekg.py")
        return 0
    else:
        print("\n✗ Download failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
