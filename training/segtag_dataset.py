import json
from torch.utils.data import Dataset

TAGS = ["O", "B-PRE", "I-PRE", "B-ROOT", "I-ROOT", "B-SUF", "I-SUF"]
TAG2ID = {t: i for i, t in enumerate(TAGS)}

class SegTagDataset(Dataset):
    def __init__(self, path: str):
        self.rows = [json.loads(l) for l in open(path, "r", encoding="utf-8") if l.strip()]

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, i: int):
        r = self.rows[i]
        chars = [ord(c) for c in r["word"]]   # still toy IDs; upgrade later if you want
        labels = [TAG2ID[x] for x in r["labels"]]
        return chars, labels
