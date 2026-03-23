from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import json

print("Creating training dataset from your bulletins...")

loader = PyPDFDirectoryLoader("data/pdfs")
docs = loader.load()

text_splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=150)
chunks = text_splitter.split_documents(docs)

dataset = []
for chunk in chunks:
    dataset.append({
        "instruction": "You are Mosupisi, expert agricultural advisor for smallholder farmers in Lesotho (especially Mohale's Hoek). Give practical, actionable advice in simple Sesotho/English. Include dekad dates, rainfall, temperature, crop stage and what the farmer should do.",
        "input": chunk.page_content,
        "output": chunk.page_content  # domain adaptation style
    })

with open("data/train.jsonl", "w", encoding="utf-8") as f:
    for item in dataset:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")

print(f"✅ Created {len(dataset)} training examples in data/train.jsonl")
print("Ready for fine-tuning!")