import sys
from pathlib import Path

# Add project root to Python path so `from app...` imports work
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
