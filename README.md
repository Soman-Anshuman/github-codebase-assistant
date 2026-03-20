To figure out which code chunk answers a user's question, we:  
  1. Embed the user's question into a vector.  
  2. Measure the angle between the question's vector and all the code chunk vectors.  
  3. The smallest angle means the highest conceptual similarity.  
We measure this using a formula called *Cosine Similarity*:  
    Cosine Similarity = (**A**•**B**)/(|A||B|)  