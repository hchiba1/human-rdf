# Human NCBI Gene RDF

## Original data

ftp.ncbi.nlm.nih.gov/gene/DATA/GENE_INFO/Mammalia/Homo_sapiens.gene_info.gz

See `./original_data/README` for details.

## RDF
```
cd human-ncbigene-rdf
npm install
./make_rdf.js original_data/Homo_sapiens.gene_info > created_rdf/Homo_sapiens.gene_info.ttl
```
