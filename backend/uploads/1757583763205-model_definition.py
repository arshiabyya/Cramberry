import torch.nn as nn
import torch

class ConvCAT(nn.Module):
    def __init__(self):
        super().__init__()
        self.relu = nn.ReLU()
        self.pool = nn.MaxPool2d(2, 2)

        self.conv1 = nn.Conv2d(3, 16, 3, padding=1)
        self.conv2 = nn.Conv2d(16, 32, 3, padding=1)
        self.conv3 = nn.Conv2d(32, 64, 3, padding=1)
        self.conv4 = nn.Conv2d(64, 128, 3, padding=1)

        self.global_pool = nn.AdaptiveAvgPool2d(1)

        self.linear1 = nn.Linear(128, 512)
        self.dropout = nn.Dropout(0.5)
        self.linear2 = nn.Linear(512, 3)  # you had 3 labels

    def forward(self, x):
        x = self.relu(self.conv1(x)); x = self.pool(x)
        x = self.relu(self.conv2(x)); x = self.pool(x)
        x = self.relu(self.conv3(x)); x = self.pool(x)
        x = self.relu(self.conv4(x)); x = self.pool(x)

        x = self.global_pool(x).flatten(start_dim=1)
        x = self.relu(self.linear1(x))
        x = self.dropout(x)
        x = self.linear2(x)
        return x
