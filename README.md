To figure out which code chunk answers a user's question, we:  
  1. Embed the user's question into a vector.  
  2. Measure the angle between the question's vector and all the code chunk vectors.  
  3. The smallest angle means the highest conceptual similarity.  

We measure this using a formula called *Cosine Similarity*:  
    Cosine Similarity = (**A**•**B**)/(|A||B|)  

### Future Optimization: Embedding Pipeline & API Rate Limits  
**The Problem:**
Currently, the ingestion pipeline processes code chunks sequentially or in uncontrolled bursts. When scaling this system to analyze large, real-world GitHub repositories, this approach will inevitably collide with LLM Embedding API (gemini-embedding-001) constraints:
* **Requests Per Minute (RPM):** Processing chunks one-by-one quickly exhausts the RPM quota (100 RPM limit).
* **Tokens Per Minute (TPM):** Sending the entire codebase in a single massive request exceeds maximum payload limits and TPM quotas (30,000 TPM limit).

**The Planned Solution (Intelligent Batching):**
To make the ingestion process production-ready, the embedding pipeline will be upgraded to use a chunked batching strategy:
1. **Batch Processing:** Group code chunks into optimized arrays (e.g., 20 chunks per request) to minimize network overhead and stay under RPM limits.
2. **Dynamic Throttling:** Introduce asynchronous delays (e.g., `setTimeout` / backoff loops) between batch requests to safely drain the TPM quota bucket and prevent `429 Too Many Requests` errors. 
3. **Retry Logic:** Implement exponential backoff for failed requests to handle transient API network errors gracefully.

### Repository Ingestion Strategy
* **Shallow Cloning:** We use git clone --depth 1 to fetch only the latest codebase snapshot, bypassing unnecessary commit history to drastically reduce download time.

* **Temporary Storage:** Repositories are cloned directly to the OS temporary directory (os.tmpdir()) and aggressively wiped via a finally block post-processing to prevent server disk space leaks.

### Code Storage tradeoff
**Vector vs. Relational Data:** By putting the `text` inside the Pinecone `metadata` object, we are storing the raw code alongside the vector. This makes our retrieval pipeline incredibly fast because we don't have to do a secondary lookup in a Postgres database to fetch the code. The tradeoff is that Pinecone metadata is not meant for storing massive paragraphs, but for our 50-line chunks, it is well within limits.