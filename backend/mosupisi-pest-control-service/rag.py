"""
Pest Control RAG (Retrieval-Augmented Generation) engine.
Uses ChromaDB for vector search over pest knowledge base and PDF documents.
Mirrors the architecture of mosupisi-planting-guide-service/rag.py.
"""

import json
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

KNOWLEDGE_PATH = Path(__file__).parent / "data" / "knowledge" / "pest_knowledge.json"
PDF_DIR = Path(__file__).parent / "data" / "pdfs"
CHROMA_DIR = Path(__file__).parent / "chroma_db"
COLLECTION_NAME = "pest_control_docs"

# Try to import ML libs - gracefully degrade if not available
try:
    import chromadb
    from chromadb.config import Settings
    from sentence_transformers import SentenceTransformer
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    logger.warning("ML libraries not available - running in knowledge-base-only mode")

try:
    from pypdf import PdfReader
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


class PestRAG:
    def __init__(self):
        self.knowledge = None
        self.chroma_client = None
        self.collection = None
        self.embedder = None
        self._initialized = False

    def initialize(self):
        """Initialize the RAG system: load knowledge base and set up vector store."""
        self._load_knowledge()

        if ML_AVAILABLE:
            self._init_embedder()
            self._init_chroma()
            self._ingest_documents()
        else:
            logger.warning("Skipping vector store - ML libs not installed")

        self._initialized = True
        logger.info("PestRAG initialized successfully")

    def _load_knowledge(self):
        """Load the curated pest knowledge JSON."""
        with open(KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
            self.knowledge = json.load(f)
        logger.info(f"Loaded {len(self.knowledge['pests'])} pest records from knowledge base")

    def _init_embedder(self):
        """Load sentence transformer model - reuse the one from planting guide if present."""
        # Check if planting guide already downloaded the model
        planting_model_dir = (
            Path(__file__).parent.parent
            / "mosupisi-planting-guide-service"
            / "models"
        )
        local_model = Path(__file__).parent / "models"

        model_name = "sentence-transformers/all-MiniLM-L6-v2"

        # Reuse cached model if available
        if (planting_model_dir / "sentence_transformer").exists():
            model_path = str(planting_model_dir / "sentence_transformer")
            logger.info(f"Reusing planting guide model from {model_path}")
        elif (local_model / "sentence_transformer").exists():
            model_path = str(local_model / "sentence_transformer")
        else:
            model_path = model_name
            logger.info(f"Downloading model: {model_name}")

        self.embedder = SentenceTransformer(model_path)

        # Save locally if not already saved
        save_path = local_model / "sentence_transformer"
        if not save_path.exists():
            save_path.mkdir(parents=True, exist_ok=True)
            self.embedder.save(str(save_path))
            logger.info(f"Model saved to {save_path}")

    def _init_chroma(self):
        """Initialize ChromaDB persistent client."""
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
        self.collection = self.chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(f"ChromaDB collection '{COLLECTION_NAME}' ready")

    def _ingest_documents(self):
        """Ingest pest knowledge + any PDFs into ChromaDB if not already done."""
        existing_count = self.collection.count()
        if existing_count > 0:
            logger.info(f"ChromaDB already has {existing_count} documents - skipping ingestion")
            return

        documents = []
        metadatas = []
        ids = []

        # 1. Ingest knowledge base entries
        for pest in self.knowledge["pests"]:
            # Build a rich text representation of each pest
            text = self._pest_to_text(pest)
            documents.append(text)
            metadatas.append({
                "source": "knowledge_base",
                "pest_id": pest["id"],
                "pest_name": pest["name"],
                "crops": ", ".join(pest["crops"]),
                "season": pest["season"],
            })
            ids.append(f"kb_{pest['id']}")

        # 2. Ingest PDFs if available
        if PDF_AVAILABLE and PDF_DIR.exists():
            for pdf_file in PDF_DIR.glob("*.pdf"):
                chunks = self._extract_pdf_chunks(pdf_file)
                for i, chunk in enumerate(chunks):
                    if chunk.strip():
                        documents.append(chunk)
                        metadatas.append({
                            "source": "pdf",
                            "filename": pdf_file.name,
                            "chunk_index": i,
                            "pest_id": "",
                            "pest_name": "",
                            "crops": "",
                            "season": "",
                        })
                        ids.append(f"pdf_{pdf_file.stem}_{i}")

        if not documents:
            logger.warning("No documents to ingest")
            return

        # Embed in batches
        batch_size = 32
        for i in range(0, len(documents), batch_size):
            batch_docs = documents[i: i + batch_size]
            batch_meta = metadatas[i: i + batch_size]
            batch_ids = ids[i: i + batch_size]
            embeddings = self.embedder.encode(batch_docs).tolist()
            self.collection.add(
                documents=batch_docs,
                embeddings=embeddings,
                metadatas=batch_meta,
                ids=batch_ids,
            )

        logger.info(f"Ingested {len(documents)} documents into ChromaDB")

    def _pest_to_text(self, pest: dict) -> str:
        """Convert a pest record to a rich searchable text string."""
        symptoms = " ".join(pest.get("symptoms", []))
        treatments = []
        for key, vals in pest.get("treatment", {}).items():
            if isinstance(vals, list):
                treatments.extend(vals)
        treatment_text = " ".join(treatments)
        prevention = " ".join(pest.get("prevention", []))

        return (
            f"Pest: {pest['name']} ({pest.get('scientific_name', '')}).\n"
            f"Also known as: {pest.get('name_st', '')}.\n"
            f"Crops affected: {', '.join(pest['crops'])}.\n"
            f"Season: {pest['season']}.\n"
            f"Description: {pest.get('description', '')}.\n"
            f"Symptoms: {symptoms}.\n"
            f"Treatment: {treatment_text}.\n"
            f"Prevention: {prevention}.\n"
            f"Lesotho context: {pest.get('lesotho_context', '')}.\n"
            f"Economic threshold: {pest.get('economic_threshold', '')}.\n"
            f"Monitoring: {pest.get('monitoring', '')}."
        )

    def _extract_pdf_chunks(self, pdf_path: Path, chunk_size: int = 500) -> list[str]:
        """Extract text from PDF and split into chunks."""
        try:
            reader = PdfReader(str(pdf_path))
            full_text = ""
            for page in reader.pages:
                full_text += page.extract_text() or ""

            # Simple chunking by characters
            chunks = []
            words = full_text.split()
            current_chunk = []
            current_len = 0
            for word in words:
                current_chunk.append(word)
                current_len += len(word) + 1
                if current_len >= chunk_size:
                    chunks.append(" ".join(current_chunk))
                    current_chunk = []
                    current_len = 0
            if current_chunk:
                chunks.append(" ".join(current_chunk))
            return chunks
        except Exception as e:
            logger.error(f"Failed to extract PDF {pdf_path}: {e}")
            return []

    def retrieve(self, query: str, n_results: int = 5) -> list[dict]:
        """Retrieve relevant documents from ChromaDB for a query."""
        if not ML_AVAILABLE or self.collection is None:
            return self._keyword_fallback(query)

        query_embedding = self.embedder.encode([query]).tolist()
        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=min(n_results, self.collection.count()),
            include=["documents", "metadatas", "distances"],
        )

        retrieved = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            retrieved.append({"text": doc, "metadata": meta, "distance": dist})
        return retrieved

    def _keyword_fallback(self, query: str) -> list[dict]:
        """Simple keyword fallback when ML libs not available."""
        query_lower = query.lower()
        results = []
        for pest in self.knowledge["pests"]:
            score = 0
            pest_text = self._pest_to_text(pest).lower()
            for word in query_lower.split():
                if word in pest_text:
                    score += 1
            if score > 0:
                results.append({
                    "text": self._pest_to_text(pest),
                    "metadata": {"pest_id": pest["id"], "source": "knowledge_base"},
                    "distance": 1.0 / (score + 1),
                })
        results.sort(key=lambda x: x["distance"])
        return results[:5]

    def get_all_pests(self) -> list[dict]:
        return self.knowledge["pests"] if self.knowledge else []

    def get_pest_by_id(self, pest_id: str) -> Optional[dict]:
        if not self.knowledge:
            return None
        for pest in self.knowledge["pests"]:
            if pest["id"] == pest_id:
                return pest
        return None

    def get_pests_by_crop(self, crop: str) -> list[dict]:
        if not self.knowledge:
            return []
        return [
            p for p in self.knowledge["pests"]
            if crop.lower() in [c.lower() for c in p["crops"]]
        ]

    def get_general_tips(self) -> dict:
        if not self.knowledge:
            return {}
        return self.knowledge.get("general_prevention_tips", {})