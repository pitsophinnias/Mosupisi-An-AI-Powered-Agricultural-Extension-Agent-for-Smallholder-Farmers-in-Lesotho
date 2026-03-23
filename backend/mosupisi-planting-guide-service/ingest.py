from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

print("🚀 Loading ALL your Lesotho Agromet Bulletins...")
loader = PyPDFDirectoryLoader("data/pdfs")
docs = loader.load()
print(f"Loaded {len(docs)} pages from your PDFs")

text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = text_splitter.split_documents(docs)
print(f"Created {len(chunks)} chunks")

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={"device": "cpu"}
)

print("Building Chroma Knowledge Base (your local RAG index)...")
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="chroma_db"
)

print("✅ DONE! Knowledge Base saved to: chroma_db")
print("This is now the full offline knowledge base for your Mosupisi system")