"""
Character-level BiLSTM for morpheme segmentation (BIO tagging)
This is a baseline model with the correct architecture for morphological segmentation.
"""

import json
from typing import List, Tuple
import torch
import torch.nn as nn
from torch.nn.utils.rnn import pad_sequence, pack_padded_sequence, pad_packed_sequence
from torch.utils.data import Dataset, DataLoader

# ✅ FIX BUG #2: Full tag names
BIO_TAGS = ["O", "B-PREFIX", "I-PREFIX", "B-ROOT", "I-ROOT", "B-SUFFIX", "I-SUFFIX"]
TAG_TO_IDX = {tag: idx for idx, tag in enumerate(BIO_TAGS)}
IDX_TO_TAG = {idx: tag for tag, idx in TAG_TO_IDX.items()}

# ✅ HIGH-LEVERAGE IMPROVEMENT #3: Character vocabulary (not ord(c))
def build_char_vocab(words: List[str]) -> dict:
    """Build character vocabulary from words"""
    chars = set("".join(words))
    # Reserve 0 for padding, 1 for unknown
    vocab = {"<PAD>": 0, "<UNK>": 1}
    for i, c in enumerate(sorted(chars), start=2):
        vocab[c] = i
    return vocab


class SegmentationDataset(Dataset):
    def __init__(self, jsonl_path: str, char_vocab: dict):
        self.examples = []
        self.char_vocab = char_vocab
        
        with open(jsonl_path, 'r') as f:
            for line in f:
                if line.strip():
                    self.examples.append(json.loads(line))
    
    def __len__(self):
        return len(self.examples)
    
    def __getitem__(self, idx):
        ex = self.examples[idx]
        word = ex["word"]
        labels = ex["labels"]
        
        # Convert chars to indices
        char_ids = [self.char_vocab.get(c, self.char_vocab["<UNK>"]) for c in word]
        label_ids = [TAG_TO_IDX[tag] for tag in labels]
        
        return torch.tensor(char_ids), torch.tensor(label_ids)


def collate_fn(batch):
    """Collate function for batching variable-length sequences"""
    char_seqs, label_seqs = zip(*batch)
    
    # Get lengths before padding
    lengths = torch.tensor([len(seq) for seq in char_seqs])
    
    # Pad sequences
    char_seqs_padded = pad_sequence(char_seqs, batch_first=True, padding_value=0)
    label_seqs_padded = pad_sequence(label_seqs, batch_first=True, padding_value=-100)  # -100 is ignored by loss
    
    return char_seqs_padded, label_seqs_padded, lengths


class CharBiLSTM(nn.Module):
    """
    Character-level BiLSTM for BIO tagging
    Unbeatable for morphology at small scale
    """
    def __init__(
        self,
        vocab_size: int,
        embedding_dim: int = 64,
        hidden_dim: int = 128,
        num_tags: int = len(BIO_TAGS),
        num_layers: int = 2,
        dropout: float = 0.3,
    ):
        super().__init__()
        
        self.embedding = nn.Embedding(vocab_size, embedding_dim, padding_idx=0)
        self.lstm = nn.LSTM(
            embedding_dim,
            hidden_dim // 2,  # bidirectional doubles it
            num_layers=num_layers,
            bidirectional=True,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(hidden_dim, num_tags)
    
    def forward(self, char_ids, lengths):
        # Embed characters
        embedded = self.embedding(char_ids)  # (batch, seq_len, emb_dim)
        
        # Pack for efficient LSTM processing
        packed = pack_padded_sequence(
            embedded, lengths.cpu(), batch_first=True, enforce_sorted=False
        )
        
        # BiLSTM
        lstm_out, _ = self.lstm(packed)
        
        # Unpack
        lstm_out, _ = pad_packed_sequence(lstm_out, batch_first=True)
        
        # Dropout + classify
        lstm_out = self.dropout(lstm_out)
        logits = self.classifier(lstm_out)  # (batch, seq_len, num_tags)
        
        return logits


def train_segmentation_model(
    train_path: str,
    val_path: str,
    epochs: int = 10,
    batch_size: int = 32,
    lr: float = 0.001,
):
    """Train the segmentation model"""
    
    # Build vocabulary from training data
    train_examples = []
    with open(train_path, 'r') as f:
        for line in f:
            if line.strip():
                train_examples.append(json.loads(line))
    
    words = [ex["word"] for ex in train_examples]
    char_vocab = build_char_vocab(words)
    
    print(f"📊 Character vocabulary size: {len(char_vocab)}")
    print(f"📊 Number of BIO tags: {len(BIO_TAGS)}")
    
    # Create datasets
    train_dataset = SegmentationDataset(train_path, char_vocab)
    val_dataset = SegmentationDataset(val_path, char_vocab)
    
    train_loader = DataLoader(
        train_dataset, batch_size=batch_size, shuffle=True, collate_fn=collate_fn
    )
    val_loader = DataLoader(
        val_dataset, batch_size=batch_size, shuffle=False, collate_fn=collate_fn
    )
    
    # Create model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = CharBiLSTM(vocab_size=len(char_vocab)).to(device)
    
    # Loss and optimizer
    criterion = nn.CrossEntropyLoss(ignore_index=-100)  # Ignore padding
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    
    print(f"🚀 Training on {device}")
    print(f"📊 Training examples: {len(train_dataset)}")
    print(f"📊 Validation examples: {len(val_dataset)}")
    
    # Training loop
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        
        for char_ids, label_ids, lengths in train_loader:
            char_ids = char_ids.to(device)
            label_ids = label_ids.to(device)
            lengths = lengths.to(device)
            
            optimizer.zero_grad()
            
            logits = model(char_ids, lengths)  # (batch, seq_len, num_tags)
            
            # Flatten for loss computation
            loss = criterion(
                logits.view(-1, len(BIO_TAGS)),
                label_ids.view(-1)
            )
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        avg_loss = total_loss / len(train_loader)
        
        # Validation
        model.eval()
        val_loss = 0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for char_ids, label_ids, lengths in val_loader:
                char_ids = char_ids.to(device)
                label_ids = label_ids.to(device)
                lengths = lengths.to(device)
                
                logits = model(char_ids, lengths)
                
                loss = criterion(
                    logits.view(-1, len(BIO_TAGS)),
                    label_ids.view(-1)
                )
                val_loss += loss.item()
                
                # Calculate accuracy (excluding padding)
                preds = logits.argmax(dim=-1)
                mask = label_ids != -100
                correct += ((preds == label_ids) & mask).sum().item()
                total += mask.sum().item()
        
        avg_val_loss = val_loss / len(val_loader)
        accuracy = correct / total if total > 0 else 0
        
        print(f"Epoch {epoch + 1}/{epochs} | "
              f"Train Loss: {avg_loss:.4f} | "
              f"Val Loss: {avg_val_loss:.4f} | "
              f"Val Acc: {accuracy:.4f}")
    
    # Save model
    torch.save({
        'model_state_dict': model.state_dict(),
        'char_vocab': char_vocab,
        'tag_to_idx': TAG_TO_IDX,
    }, 'segmentation_model.pt')
    
    print("✅ Model saved to segmentation_model.pt")
    
    return model, char_vocab


if __name__ == "__main__":
    # Example usage
    print("🔧 Character BiLSTM Segmentation Model")
    print("Run with actual dataset files to train")
    
    # Uncomment to train:
    # train_segmentation_model(
    #     train_path="data/segmentation_train.jsonl",
    #     val_path="data/segmentation_val.jsonl",
    #     epochs=20,
    # )
