"""
Affix-count MLP for semantic classification
Interpretable + fast baseline model
"""

import json
from typing import List, Dict, Tuple
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader


class SemanticDataset(Dataset):
    def __init__(self, jsonl_path: str, affix_vocab: Dict[str, int] = None):
        self.examples = []
        self.all_affixes = set()
        self.all_tags = set()
        
        # First pass: collect all affixes and tags
        with open(jsonl_path, 'r') as f:
            for line in f:
                if line.strip():
                    ex = json.loads(line)
                    self.examples.append(ex)
                    self.all_affixes.update(ex.get("prefixes", []))
                    self.all_affixes.update(ex.get("suffixes", []))
                    self.all_tags.update(ex.get("tags", []))
        
        # Build vocabularies
        if affix_vocab is None:
            self.affix_vocab = {affix: idx for idx, affix in enumerate(sorted(self.all_affixes))}
        else:
            self.affix_vocab = affix_vocab
        
        self.tag_vocab = {tag: idx for idx, tag in enumerate(sorted(self.all_tags))}
        
    def __len__(self):
        return len(self.examples)
    
    def __getitem__(self, idx):
        ex = self.examples[idx]
        
        # Create affix count vector
        affix_counts = torch.zeros(len(self.affix_vocab))
        for prefix in ex.get("prefixes", []):
            if prefix in self.affix_vocab:
                affix_counts[self.affix_vocab[prefix]] += 1
        for suffix in ex.get("suffixes", []):
            if suffix in self.affix_vocab:
                affix_counts[self.affix_vocab[suffix]] += 1
        
        # Create multi-hot tag vector
        tag_vector = torch.zeros(len(self.tag_vocab))
        for tag in ex.get("tags", []):
            if tag in self.tag_vocab:
                tag_vector[self.tag_vocab[tag]] = 1
        
        # Get complexity and confidence
        complexity = ex.get("complexity", 0)
        confidence = ex.get("confidence", 1.0)
        
        return affix_counts, tag_vector, torch.tensor([complexity], dtype=torch.float), torch.tensor([confidence], dtype=torch.float)


class AffixCountMLP(nn.Module):
    """
    Simple MLP that takes affix counts and predicts semantic tags
    Interpretable and fast
    """
    def __init__(
        self,
        num_affixes: int,
        num_tags: int,
        hidden_dim: int = 128,
        dropout: float = 0.3,
    ):
        super().__init__()
        
        # Add complexity as an additional feature
        input_dim = num_affixes + 1  # +1 for complexity
        
        self.mlp = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, num_tags),
        )
    
    def forward(self, affix_counts, complexity):
        # Concatenate affix counts with complexity
        features = torch.cat([affix_counts, complexity], dim=1)
        logits = self.mlp(features)
        return logits


def train_semantic_model(
    train_path: str,
    val_path: str,
    epochs: int = 20,
    batch_size: int = 32,
    lr: float = 0.001,
):
    """Train the semantic classification model"""
    
    # Create datasets
    train_dataset = SemanticDataset(train_path)
    val_dataset = SemanticDataset(val_path, affix_vocab=train_dataset.affix_vocab)
    
    print(f"📊 Number of unique affixes: {len(train_dataset.affix_vocab)}")
    print(f"📊 Number of unique tags: {len(train_dataset.tag_vocab)}")
    
    train_loader = DataLoader(
        train_dataset, batch_size=batch_size, shuffle=True
    )
    val_loader = DataLoader(
        val_dataset, batch_size=batch_size, shuffle=False
    )
    
    # Create model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = AffixCountMLP(
        num_affixes=len(train_dataset.affix_vocab),
        num_tags=len(train_dataset.tag_vocab),
    ).to(device)
    
    # Multi-label classification uses BCE with logits
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    
    print(f"🚀 Training on {device}")
    print(f"📊 Training examples: {len(train_dataset)}")
    print(f"📊 Validation examples: {len(val_dataset)}")
    
    # Training loop
    best_val_loss = float('inf')
    
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        
        for affix_counts, tag_vector, complexity, confidence in train_loader:
            affix_counts = affix_counts.to(device)
            tag_vector = tag_vector.to(device)
            complexity = complexity.to(device)
            confidence = confidence.to(device)
            
            optimizer.zero_grad()
            
            logits = model(affix_counts, complexity)
            
            # ✅ Can weight loss by confidence for active learning
            loss = criterion(logits, tag_vector)
            # Optionally: loss = (criterion(logits, tag_vector) * confidence).mean()
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        avg_loss = total_loss / len(train_loader)
        
        # Validation
        model.eval()
        val_loss = 0
        
        with torch.no_grad():
            for affix_counts, tag_vector, complexity, confidence in val_loader:
                affix_counts = affix_counts.to(device)
                tag_vector = tag_vector.to(device)
                complexity = complexity.to(device)
                
                logits = model(affix_counts, complexity)
                loss = criterion(logits, tag_vector)
                val_loss += loss.item()
        
        avg_val_loss = val_loss / len(val_loader)
        
        print(f"Epoch {epoch + 1}/{epochs} | "
              f"Train Loss: {avg_loss:.4f} | "
              f"Val Loss: {avg_val_loss:.4f}")
        
        # Save best model
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            torch.save({
                'model_state_dict': model.state_dict(),
                'affix_vocab': train_dataset.affix_vocab,
                'tag_vocab': train_dataset.tag_vocab,
            }, 'semantic_model.pt')
            print("  ✅ Saved best model")
    
    print("✅ Training complete!")
    
    return model, train_dataset.affix_vocab, train_dataset.tag_vocab


def predict_tags(model, affix_vocab, tag_vocab, word_data: dict):
    """
    Predict semantic tags for a single word
    
    Args:
        model: Trained AffixCountMLP
        affix_vocab: Affix vocabulary dict
        tag_vocab: Tag vocabulary dict
        word_data: Dict with 'prefixes', 'suffixes', 'complexity'
    
    Returns:
        List of predicted tags
    """
    device = next(model.parameters()).device
    
    # Create affix count vector
    affix_counts = torch.zeros(len(affix_vocab))
    for prefix in word_data.get("prefixes", []):
        if prefix in affix_vocab:
            affix_counts[affix_vocab[prefix]] += 1
    for suffix in word_data.get("suffixes", []):
        if suffix in affix_vocab:
            affix_counts[affix_vocab[suffix]] += 1
    
    complexity = torch.tensor([[word_data.get("complexity", 0)]], dtype=torch.float)
    
    affix_counts = affix_counts.unsqueeze(0).to(device)
    complexity = complexity.to(device)
    
    model.eval()
    with torch.no_grad():
        logits = model(affix_counts, complexity)
        probs = torch.sigmoid(logits)
    
    # Get tags above threshold
    threshold = 0.5
    predicted_tags = []
    idx_to_tag = {idx: tag for tag, idx in tag_vocab.items()}
    
    for idx, prob in enumerate(probs[0]):
        if prob > threshold:
            predicted_tags.append(idx_to_tag[idx])
    
    return predicted_tags, probs[0].cpu().numpy()


if __name__ == "__main__":
    print("🔧 Affix-Count MLP Semantic Classification Model")
    print("Run with actual dataset files to train")
    
    # Uncomment to train:
    # train_semantic_model(
    #     train_path="data/semantic_train.jsonl",
    #     val_path="data/semantic_val.jsonl",
    #     epochs=30,
    # )
