#!/usr/bin/env node
const fs = require('fs');
const program = require('commander');
const readline = require('readline');

program
  .option('-v, --verbose', 'output internal object')
  .arguments('<original_data_file>')
  .parse(process.argv);

if (program.args.length == 0) {
  program.help();
}
const opts = program.opts();

const rs = fs.createReadStream(program.args[0], 'utf8');
const rl = readline.createInterface({ input: rs });

let header = [];
rl.on('line', (line) => {
  const fields = line.split('\t');
  if (header.length === 0) {
    header = line.replace(/^#/, '').split('\t');
    header.forEach((val) => {
      if (!/^\w+$/.test(val)) {
        console.error(val);
        process.exit(1);
      }
    });
    printPrefix();
  } else if (header.length === fields.length) {
    const entry = makeMap(fields);
    if (opts.verbose) {
      console.log(entry);
    }
    printTriples(entry);
  } else {
    process.exit(1);
  }
});

function makeMap(fields) {
  const entry = new Map();
  fields.forEach((val, i) => {
    if (!/[\w-]/.test(val) ||
        /^\s/.test(val) ||
        /\s$/.test(val)
       ) {
      console.error(val);
      process.exit(1);
    }
    entry.set(header[i], val);
  });
  return entry;
}

function printPrefix() {
  console.log("@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .");
  console.log("@prefix dct: <http://purl.org/dc/terms/> .");
  console.log("@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .");
  console.log("@prefix ncbigene: <http://identifiers.org/ncbigene/> .");
  console.log("@prefix taxid: <http://identifiers.org/taxonomy/> .");
  console.log("@prefix hgnc: <http://identifiers.org/ngnc/> .");
  console.log("@prefix mim: <http://identifiers.org/mim/> .");
  console.log("@prefix mirbase: <http://identifiers.org/mirbase/> .");
  console.log("@prefix ensembl: <http://identifiers.org/ensembl/> .");
  console.log("@prefix nuc: <http://ddbj.nig.ac.jp/ontologies/nucleotide/> .");
  console.log("@prefix : <http://purl.org/net/orthordf/hOP/ontology#> .");
}

function printTriples(entry) {
  if (!/^\d+$/.test(entry.get('GeneID')) ||
      !/^\d+$/.test(entry.get('tax_id')) ||
      !isValidString(entry.get('Symbol')) ||
      !isValidString(entry.get('description')) ||
      !isValidString(entry.get('Symbol_from_nomenclature_authority')) ||
      !isValidString(entry.get('Full_name_from_nomenclature_authority')) ||
      entry.get('LocusTag') != '-'
     ) {
    console.error(entry);
    process.exit(1);
  }

  console.log('');
  console.log(`ncbigene:${entry.get('GeneID')} a nuc:Gene ;`);
  // console.log(`        sio:SIO_010035 ;`);
  console.log(`    dct:identifier ${entry.get('GeneID')} ;`);
  console.log(`    rdfs:label "${entry.get('Symbol')}" ;`);
  if (entry.get('Symbol_from_nomenclature_authority') !== '-') {
    // console.log(`    skos:prefLabel "${entry.get('Symbol_from_nomenclature_authority')}" ;`);
    console.log(`    nuc:standard_name "${entry.get('Symbol_from_nomenclature_authority')}" ;`);
  }
  if (entry.get('Synonyms') != '-') {
    const synonyms = entry.get('Synonyms').split('|')
          .map((d) => mapToStr(d))
          .join(' ,\n' + ' '.repeat(8));
    // console.log(`    skos:altLabel ${synonyms} ;`);
    console.log(`    nuc:gene_synonym ${synonyms} ;`);
  }
  console.log(`    dct:description "${entry.get('description')}" ;`);
  if (entry.get('Other_designations') != '-') {
    const other_designations = entry.get('Other_designations').split('|')
          .map((d) => mapToStr(d))
          .join(' ,\n' + ' '.repeat(8));
    console.log(`    dct:alternative ${other_designations} ;`);
  }
  if (entry.get('dbXrefs') != '-') {
    const seeAlso = entry.get('dbXrefs').split('|')
          .map((d) => makeURI(d)).filter(x => x)
          .join(' ,\n' + ' '.repeat(8));
    // console.log(`    rdfs:seeAlso ${seeAlso} ;`);
    console.log(`    nuc:dblink ${seeAlso} ;`);
  }
  const type_of_gene = entry.get('type_of_gene');
  // const uri = hasClass(type_of_gene);
  // if (uri) {
  //   console.log(`    a ${uri} ;`);
  // }
  console.log(`    :typeOfGene "${entry.get('type_of_gene')}" ;`);
  if (entry.get('Nomenclature_status') === 'O') {
    console.log(`    :nomenclatureStatus "official" ;`);
  } else if (entry.get('Nomenclature_status') === 'I') {
    console.log(`    :nomenclatureStatus "interim" ;`);
  } else if (entry.get('Nomenclature_status') !== '-') {
    console.error(entry);
    process.exit(1);
  }
  if (entry.get('Full_name_from_nomenclature_authority') != '-') {
    console.log(`    :fullName "${entry.get('Full_name_from_nomenclature_authority')}" ;`);
  }
  if (entry.get('dbXrefs') != '-') {
    let dbXrefs = entry.get('dbXrefs').split('|')
        .map((d) => filterStr(d)).filter(x => x);
    if (dbXrefs.length !== 0) {
      dbXrefs = dbXrefs.join(' ,\n' + ' '.repeat(8));
      console.log(`    nuc:db_xref ${dbXrefs} ;`);
    }
  }
  if (entry.get('Feature_type') != '-') {
    const feature_type = entry.get('Feature_type').split('|')
          .map((d) => `"${d}"`)
          .join(' ,\n' + ' '.repeat(8));
    console.log(`    :featureType ${feature_type} ;`);
  }
  console.log(`    :taxid taxid:${entry.get('tax_id')} ;`);
  console.log(`    nuc:chromosome "${entry.get('chromosome')}" ;`);
  console.log(`    nuc:map "${entry.get('map_location')}" ;`);
  console.log(`    dct:modified "${formatDate(entry.get('Modification_date'))}"^^xsd:date .`);
}

function makeURI(str) {
  if (/^MIM:\d+$/.test(str)) {
    const [, id] = /^MIM:(\d+)$/.exec(str);
    return `mim:${id}`;
  } else if (/^HGNC:HGNC:\d+$/.test(str)) {
    const [, id] = /^HGNC:HGNC:(\d+)$/.exec(str);
    return `hgnc:${id}`;
  } else if (/^Ensembl:ENSG\d+$/.test(str)) {
    const [, id] = /^Ensembl:(ENSG\d+)$/.exec(str);
    return `ensembl:${id}`;
  } else if (/^miRBase:MI\d+$/.test(str)) {
    const [, id] = /^miRBase:(MI\d+)$/.exec(str);
    return `mirbase:${id}`;
  } else {
    // console.error(str);
  }
}

function filterStr(str) {
  if (/^MIM:\d+$/.test(str)) {
  } else if (/^HGNC:HGNC:\d+$/.test(str)) {
  } else if (/^Ensembl:ENSG\d+$/.test(str)) {
  } else if (/^miRBase:MI\d+$/.test(str)) {
  } else {
    return `"${str}"`;
  }
}

function isValidString(str) {
  if (/^[-\w @\.'/+:,();>?\[\]#*&~{}=\^]+$/.test(str)) {
    return true;
  } else {
    return false;
  }
}

function mapToStr(str) {
  if (isValidString(str)) {
    return `"${str}"`
  } else {
    console.error(str);
    process.exit(1);
  }
}

function formatDate(date) {
  if (/^\d{8}$/.test(date)) {
    const [, y, m, d] = /^(\d{4})(\d{2})(\d{2})$/.exec(date);
    return `${y}-${m}-${d}`;
  } else {
    console.error(date);
    process.exit(1);
  }
}

function hasClass(str) {
  if (str === 'protein-coding') {
    return 'sio:SIO_000985';
  } else if (str === 'pseudo') {
    return 'sio:SIO_000988';
  } else if (str === 'ncRNA') {
    return 'sio:SIO_000790';
  } else if (str === 'tRNA') {
    return 'sio:SIO_001230';
  } else if (str === 'rRNA') {
    return 'sio:SIO_001182';
  } else if (str === 'snoRNA') {
    return 'sio:SIO_001229';
  } else if (str === 'snRNA') {
    return 'sio:SIO_001228';
  } else if (str === 'scRNA') {
    return 'sio:SIO_001227';
  } else if (str === 'biological-region') {
    return 'obo:SO_0001411';
  }
}
