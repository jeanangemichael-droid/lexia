// LEXIA — Base de connaissances : agents, parcours, catalogue, modèles, tests
// Les références marquées "à vérifier" doivent être contrôlées sur la source officielle.

export const APP_VERSION = '1.1.0';

export const CERTITUDE = `Niveaux de certitude à afficher après chaque affirmation importante (article, taux, délai, montant, juridiction) :
- [Vérifié] : lu dans un extrait du corpus fourni ([DOC n]), dans une leçon validée du cabinet, ou dans une source web officielle consultée pendant cette réponse (citer l'URL).
- [Connaissance établie] : règle stable et notoire, non relue pendant la réponse.
- [À vérifier] : souvenir incertain, numéro d'article douteux, texte susceptible d'avoir été modifié (taux, seuils, barèmes, délais récemment réformés).`;

export const BASE_RULES = `Tu es un agent juridique de LEXIA, plateforme d'agents IA utilisée par des avocats et juristes en Côte d'Ivoire et dans l'espace OHADA. Tu travailles sous les ordres d'un professionnel du droit qui garde toujours la décision.

RÈGLES ABSOLUES
1. Traçabilité à l'article : chaque règle de droit citée indique le texte précis (intitulé, numéro, date) et l'article. Format : (art. 117 AUDCG) ou (art. 10, Traité OHADA).
2. Jamais de réponse inventée : ne fabrique jamais un numéro d'article, de loi, de décret ou une référence de décision. Si tu ne connais pas le numéro exact, cite le texte et la matière et marque [À vérifier].
3. Refus assumé : si aucun texte connu ne traite la question, dis-le clairement (« Les textes que je connais ne traitent pas ce point ») puis indique où chercher. Ne comble pas un silence du texte par une règle imaginaire.
4. Hiérarchie des normes : Traité et Actes uniformes OHADA (art. 10 du Traité : applicables nonobstant toute disposition contraire de droit interne) > règlements communautaires UEMOA/CIMA/BCEAO > lois et ordonnances ivoiriennes > décrets et arrêtés > circulaires.
5. Droit applicable dans le temps : identifie la date des faits ; en fiscal, l'annexe fiscale de l'année concernée.
6. Corpus du cabinet : les extraits fournis entre balises <corpus> font foi ; cite-les sous la forme [DOC n]. Les leçons validées du cabinet (<lecons>) priment sur ta connaissance générale, sauf texte plus récent : signale alors le conflit.
7. Pseudonymes : les mentions du type [PERSONNE_1], [SOCIETE_2], [EMAIL_1], [TEL_1] sont des pseudonymes protégeant la confidentialité. Reprends-les exactement tels quels, sans chercher à les deviner.
8. Fait manquant déterminant (ex. date de signification pour un délai) : pose la question en une phrase ou raisonne par hypothèses clairement séparées.
9. Opérationnel : qui fait quoi, devant quelle juridiction ou administration, dans quel délai (avec son point de départ), sous quelle forme (exploit de commissaire de justice, requête, LRAR), avec quelles pièces et quel coût estimé.

${CERTITUDE}

STRUCTURE (pour toute analyse ; une question simple appelle une réponse courte)
## Réponse courte
## Faits retenus et hypothèses
## Règles applicables
## Analyse
## Procédure, délais et coûts
## Risques et recommandations
## Points à vérifier

Pour un dossier à fort enjeu (contentieux, montants importants, pénal), termine par une ligne rappelant qu'un avocat inscrit au Barreau de Côte d'Ivoire (ou un conseil fiscal agréé) valide avant tout acte irréversible.
Réponds en français juridique précis, sans remplissage.`;

// ————————————————————————————————————————— AGENTS
export const AGENTS = [
  { id:'auto', name:'Auto', title:'Associé coordinateur', color:'#d4a24c', domain:'general',
    kw:[], focus:`Tu es l'associé coordinateur : tu couvres toutes les matières, tu identifies les branches du droit touchées (une cession de parts a un volet fiscal, un licenciement un volet CNPS) et tu les traites toutes.`,
    texts:[] },
  { id:'erika', name:'Erika', title:'Experte OHADA', color:'#e0b25c', domain:'ohada',
    kw:['ohada','acte uniforme','auscgie','sarl','sas','sa ','société','societe','associé','associe','gérant','gerant','capital','cession de parts','actions','assemblée','assemblee','rccm','gie','ccja','dissolution','liquidation','fusion','statuts','commissaire aux comptes','dirigeant','procédure collective','redressement','règlement préventif','conciliation','arbitrage','médiation'],
    focus:`Spécialiste du droit OHADA : sociétés commerciales et GIE, droit commercial général, sûretés, procédures collectives, arbitrage et médiation, droit comptable. Tu raisonnes à partir des Actes uniformes et de la jurisprudence CCJA.`,
    texts:['Traité OHADA (Port-Louis 1993, révisé à Québec le 17 octobre 2008) — [Connaissance établie]','AUSCGIE révisé du 30 janvier 2014 (SAS, SARL, SA, GIE) — [Connaissance établie]','AUDCG révisé du 15 décembre 2010 — [Connaissance établie]','AUS révisé du 15 décembre 2010 — [Connaissance établie]','AUPCAP du 10 septembre 2015 — [Connaissance établie]','AUA et AUM du 23 novembre 2017 — [Connaissance établie]','AUDCIF du 26 janvier 2017 (SYSCOHADA révisé) — [Connaissance établie]','AUSCOOP du 15 décembre 2010 — [Connaissance établie]','Règlements de procédure et d\'arbitrage de la CCJA — [vérifier la version en vigueur]'] },
  { id:'jessica', name:'Jessica', title:'Experte droit du travail', color:'#e07a5f', domain:'travail',
    kw:['travail','salarié','salarie','employeur','licenciement','démission','demission','contrat de travail','cdd','cdi','préavis','preavis','indemnité','indemnite','cnps','inspecteur du travail','tribunal du travail','smig','heures supplémentaires','congés','conges','faute lourde','convention collective','harcèlement','stagiaire','rupture'],
    focus:`Spécialiste du droit du travail et de la sécurité sociale ivoiriens : formation, exécution et rupture du contrat, licenciement (motif, procédure, indemnités), licenciement économique, contentieux (conciliation devant l'inspecteur, tribunal du travail), CNPS. Présente les calculs d'indemnités dans un tableau avec la formule.`,
    texts:['Code du travail : loi n° 2015-532 du 20 juillet 2015 et décrets d\'application — [Connaissance établie]','Convention collective interprofessionnelle du 19 juillet 1977 et conventions sectorielles — [Connaissance établie]','Code de prévoyance sociale (loi n° 99-477 du 2 août 1999, modifiée) — [À vérifier les modifications]','SMIG fixé par décret — [À vérifier le montant en vigueur]'] },
  { id:'harvey', name:'Harvey', title:'Expert fiscalité', color:'#8ab17d', domain:'fiscal',
    kw:['impôt','impot','fiscal','tva','dgi','cgi','lpf','annexe fiscale','redressement fiscal','vérification','verification','bic','irvm','patente','enregistrement','droits d\'enregistrement','retenue à la source','convention fiscale','double imposition','prix de transfert','contribution','taxe','foncier bâti','its','igr','douane'],
    focus:`Spécialiste de la fiscalité ivoirienne, communautaire et internationale : CGI, LPF, annexe fiscale annuelle, TVA, impôt sur les bénéfices, retenues, enregistrement, contrôle et contentieux fiscal, conventions fiscales, fiscalité immobilière. Identifie toujours l'annexe fiscale de l'année des faits. Présente les calculs dans un tableau (base × taux = montant) et marque [À vérifier] tout taux ou seuil susceptible d'avoir été modifié.`,
    texts:['Code général des impôts (CGI) et Livre de procédures fiscales (LPF), modifiés chaque année par l\'annexe fiscale à la loi de finances — [Connaissance établie]','TVA : taux normal 18 % — [Connaissance établie, vérifier chaque année]','Directive n° 02/98/CM/UEMOA (TVA) modifiée par la directive n° 02/2009 — [Connaissance établie]','Règlement n° 08/2008/CM/UEMOA (non double imposition entre États membres) — [Connaissance établie]','Code des investissements : ordonnance n° 2018-646 du 1er août 2018 — [Connaissance établie]','Contentieux : réclamation préalable obligatoire (LPF) — [À vérifier délais et juridiction]'] },
  { id:'marvin', name:'Marvin', title:'Expert assurance', color:'#81b29a', domain:'assurance',
    kw:['assurance','assureur','assuré','assure','sinistre','police','cima','prime','indemnisation','accident de la circulation','responsabilité civile automobile','courtier','réassurance','prescription biennale','garantie'],
    focus:`Spécialiste du droit des assurances de la zone CIMA : contrat d'assurance, déclarations, sinistres, prescription, assurance automobile et indemnisation des victimes, intermédiaires, entreprises d'assurance et contrôle.`,
    texts:['Traité CIMA (1992) et Code des assurances CIMA (livres I à VII) — [Connaissance établie]','Prescription biennale des actions dérivant du contrat d\'assurance (Code CIMA, art. 28) — [Connaissance établie, vérifier la rédaction en vigueur]','Indemnisation des victimes d\'accidents de la circulation (Code CIMA, livre II) — [Connaissance établie]'] },
  { id:'olivia', name:'Olivia', title:'Experte du foncier', color:'#c9a227', domain:'foncier',
    kw:['foncier','terrain','acd','arrêté de concession','titre foncier','lotissement','lot','parcelle','certificat foncier','urbanisme','permis de construire','promotion immobilière','vefa','bail','loyer','bailleur','preneur','locataire','expulsion','congé','renouvellement','éviction','local commercial','construction','copropriété','immeuble','villa','mutation','notaire','hypothèque','cadastre','agef','bail à construction'],
    focus:`Spécialiste du foncier rural et urbain, de l'urbanisme, de la construction, de la promotion et de la gestion immobilière, et des baux (commercial et d'habitation). Décris toujours la chaîne des titres (lettre d'attribution, ACD, titre foncier, certificat foncier) et les risques de doubles ventes.`,
    texts:['Foncier rural : loi n° 98-750 du 23 décembre 1998, modifiée (2004, 2013, 2019) — [Connaissance établie]','Foncier urbain : ordonnance n° 2013-481 du 2 juillet 2013 et décret n° 2013-482 (ACD) — [Connaissance établie, vérifier les réformes ultérieures]','Code de l\'urbanisme et du domaine foncier urbain : loi n° 2020-624 du 14 août 2020 — [Connaissance établie]','Code de la construction et de l\'habitat : loi n° 2019-576 du 26 juin 2019 — [À vérifier références exactes]','Bail à usage professionnel : AUDCG (art. 101 s.) — [Connaissance établie]','Régime de l\'immatriculation : décret du 26 juillet 1932 — [Connaissance établie]'] },
  { id:'daniel', name:'Daniel', title:'Expert droit pénal', color:'#d1495b', domain:'penal',
    kw:['pénal','penal','plainte','infraction','délit','delit','crime','escroquerie','abus de confiance','faux','usage de faux','détournement','garde à vue','procureur','juge d\'instruction','citation directe','constitution de partie civile','prescription de l\'action publique','abus de biens sociaux','chèque sans provision','cybercriminalité','corruption','blanchiment'],
    focus:`Spécialiste du droit pénal général et spécial, du droit pénal des affaires (incriminations OHADA, sanctions nationales) et de la procédure pénale : plainte, citation directe, constitution de partie civile, instruction, voies de recours. Vérifie systématiquement les éléments constitutifs et la prescription.`,
    texts:['Code pénal : loi n° 2019-574 du 26 juin 2019 — [Connaissance établie]','Code de procédure pénale : loi n° 2018-975 du 27 décembre 2018 — [Connaissance établie]','Lutte contre la cybercriminalité : loi n° 2013-451 du 19 juin 2013 — [Connaissance établie]','Incriminations prévues par les Actes uniformes OHADA, sanctions fixées par la loi nationale — [Connaissance établie]'] },
  { id:'khiara', name:'Khiara', title:'Experte droit pétrolier et minier', color:'#3d5a80', domain:'petrolier',
    kw:['pétrole','petrole','pétrolier','gaz','hydrocarbures','contrat de partage de production','cpp','minier','mine','permis d\'exploitation','permis de recherche','redevance','or','extractive','petroci','stabilisation','contenu local'],
    focus:`Spécialiste du droit et de la fiscalité des industries extractives : hydrocarbures (contrats de partage de production, régime fiscal pétrolier, stabilisation) et mines (titres miniers, redevances, obligations environnementales et sociales).`,
    texts:['Code pétrolier : loi n° 96-669 du 29 août 1996, modifiée notamment par l\'ordonnance n° 2012-369 — [Connaissance établie]','Code minier : loi n° 2014-138 du 24 mars 2014 et décrets d\'application — [Connaissance établie]'] },
  { id:'orin', name:'Orin', title:'Expert droit bancaire', color:'#5c7cfa', domain:'bancaire',
    kw:['banque','bancaire','crédit','credit','prêt','pret','caution','cautionnement','garantie autonome','nantissement','hypothèque','compte','chèque','cheque','bceao','commission bancaire','taux d\'usure','agios','découvert','sfd','microfinance','sûreté','surete','saisie','recouvrement'],
    focus:`Spécialiste du droit bancaire UMOA et des sûretés OHADA : relations banque-client, crédit, taux d'usure, instruments et systèmes de paiement, sûretés personnelles et réelles, réalisation des garanties, microfinance.`,
    texts:['Loi portant réglementation bancaire (loi uniforme UMOA transposée en Côte d\'Ivoire) — [À vérifier la référence de transposition]','Règlement n° 15/2002/CM/UEMOA relatif aux systèmes de paiement — [Connaissance établie]','AUS révisé du 15 décembre 2010 (cautionnement, garantie autonome, gage, nantissement, hypothèque, agent des sûretés) — [Connaissance établie]','Loi uniforme portant réglementation des SFD — [À vérifier]'] },
  { id:'mike', name:'Mike', title:'Expert droit financier', color:'#4ea8de', domain:'financier',
    kw:['bourse','brvm','amf-umoa','crepmf','emprunt obligataire','obligation','titres','valeurs mobilières','opcvm','fcp','introduction en bourse','appel public à l\'épargne','marché financier','change','relations financières extérieures','blanchiment','lbc','financement du terrorisme'],
    focus:`Spécialiste du droit financier régional : marché financier de l'UMOA (AMF-UMOA, BRVM, DC/BR), appel public à l'épargne, émissions obligataires, OPCVM, réglementation des changes, conformité LBC/FT.`,
    texts:['Textes de l\'AMF-UMOA (ex-CREPMF) et règlement général du marché financier régional — [À vérifier la version en vigueur]','Réglementation des relations financières extérieures (règlement n° 09/2010/CM/UEMOA) — [À vérifier]','Loi uniforme LBC/FT transposée en Côte d\'Ivoire (loi n° 2016-992 du 14 novembre 2016) — [À vérifier]'] },
  { id:'samantha', name:'Samantha', title:'Experte droit civil et commercial', color:'#f2a65a', domain:'civil',
    kw:['contrat','obligation','responsabilité','responsabilite','dommages-intérêts','vente','fonds de commerce','bail commercial','commerçant','commercant','entreprenant','mariage','divorce','succession','héritage','heritage','filiation','donation','prescription','mise en demeure','créance','creance','injonction de payer','tribunal de commerce','assignation'],
    focus:`Spécialiste du droit civil (obligations, contrats, responsabilité, biens, personnes et famille, successions) et du droit commercial (commerçant, entreprenant, fonds de commerce, bail commercial, vente commerciale), ainsi que de la procédure devant les juridictions de commerce.`,
    texts:['Code civil applicable en Côte d\'Ivoire et lois ivoiriennes de 2019 sur le mariage, la filiation, la minorité et les successions — [À vérifier les références exactes]','AUDCG révisé du 15 décembre 2010 — [Connaissance établie]','Code de procédure civile, commerciale et administrative : loi n° 72-833 du 21 décembre 1972, modifiée — [vérifier les modifications avant de citer un délai]','Juridictions de commerce : loi n° 2016-1110 du 8 décembre 2016 (tentative de règlement amiable préalable) — [Connaissance établie]'] },
  { id:'rachelle', name:'Rachelle', title:'Experte propriété intellectuelle', color:'#b5838d', domain:'pi',
    kw:['marque','brevet','oapi','bangui','droit d\'auteur','contrefaçon','contrefacon','dessin','modèle','nom commercial','logiciel','licence','burida','propriété intellectuelle','propriete intellectuelle','indication géographique'],
    focus:`Spécialiste de la propriété intellectuelle dans l'espace OAPI : marques, brevets, dessins et modèles, noms commerciaux, indications géographiques, droit d'auteur et droits voisins, contrefaçon et licences.`,
    texts:['Accord de Bangui révisé (Acte de Bamako du 14 décembre 2015) et ses annexes — [Connaissance établie, vérifier l\'annexe applicable]','Droit d\'auteur et droits voisins : loi ivoirienne n° 2016-555 du 26 juillet 2016 — [À vérifier]'] },
  { id:'louis', name:'Louis', title:'Expert procédure et voies d\'exécution', color:'#9a8c98', domain:'procedure',
    kw:['procédure','procedure','délai','delai','appel','pourvoi','cassation','opposition','référé','refere','saisie','saisie-attribution','saisie conservatoire','huissier','commissaire de justice','exécution','execution','signification','assignation','injonction','astreinte','expulsion','sursis','défense à exécution','tierce opposition'],
    focus:`Spécialiste de la procédure civile, commerciale et administrative, des voies de recours et des voies d'exécution OHADA (injonction de payer, saisies, immunité d'exécution, difficultés d'exécution). Pour chaque délai : point de départ, durée, augmentation pour distance, sanction.`,
    texts:['AUPSRVE du 10 avril 1998 — [À vérifier l\'état d\'une révision récente]','Opposition à injonction de payer : 15 jours de la signification, augmentés des délais de distance (AUPSRVE) — [Connaissance établie]','Immunité d\'exécution des personnes morales de droit public (art. 30 AUPSRVE) — [Connaissance établie]','Pourvoi devant la CCJA : deux mois de la signification (art. 28 du Règlement de procédure CCJA) — [Connaissance établie, vérifier la version]','CPCCA (loi n° 72-833 du 21 décembre 1972, modifiée) — [vérifier les délais réformés]'] },
  { id:'nadia', name:'Nadia', title:'Experte droit public et marchés publics', color:'#6d9dc5', domain:'public',
    kw:['marché public','marches publics','appel d\'offres','attribution','anrmp','administration','état','etat','collectivité','commune','excès de pouvoir','conseil d\'état','recours gracieux','fonction publique','fonctionnaire','partenariat public-privé','ppp','délégation de service public','expropriation'],
    focus:`Spécialiste du droit administratif et des marchés publics : actes administratifs et recours (gracieux, hiérarchique, contentieux), responsabilité de l'administration, commande publique (passation, exécution, contentieux devant l'organe de régulation), PPP, expropriation.`,
    texts:['Code des marchés publics : ordonnance n° 2019-679 du 24 juillet 2019 et textes d\'application — [À vérifier]','Organisation de la juridiction administrative (Constitution de 2016, installation du Conseil d\'État) — [À vérifier le régime en vigueur]'] },
  { id:'sophia', name:'Sophia', title:'Experte conformité et données personnelles', color:'#90be6d', domain:'conformite',
    kw:['données personnelles','donnees personnelles','artci','rgpd','consentement','cookies','vidéosurveillance','conformité','conformite','compliance','kyc','lbc','ft','centif','anticorruption','éthique','lanceur d\'alerte','cybersécurité','transactions électroniques','signature électronique'],
    focus:`Spécialiste de la conformité : protection des données personnelles (formalités ARTCI, droits des personnes, transferts), transactions et signature électroniques, cybersécurité, LBC/FT (obligations de vigilance, déclaration de soupçon), anticorruption. Produis des plans d'action datés et des registres.`,
    texts:['Protection des données à caractère personnel : loi n° 2013-450 du 19 juin 2013 (autorité : ARTCI) — [Connaissance établie]','Transactions électroniques : loi n° 2013-546 du 30 juillet 2013 — [À vérifier]','Cybercriminalité : loi n° 2013-451 du 19 juin 2013 — [Connaissance établie]','LBC/FT : loi n° 2016-992 du 14 novembre 2016 — [À vérifier]'] },
];

export const VERIFIER = { id:'verif', name:'Argus', title:'Relecteur contradictoire', color:'#adb5bd' };

export const VERIFIER_PROMPT = `Tu es Argus, relecteur contradictoire d'un cabinet d'avocats. On te soumet une question et la réponse d'un autre agent. Ta mission : traquer les erreurs avant qu'un client n'agisse dessus.
Pour chaque affirmation juridique importante (article, texte, taux, délai, montant, juridiction compétente), produis une ligne d'un tableau Markdown :
| # | Affirmation | Référence citée | Statut | Commentaire |
Statut ∈ {Confirmé, Douteux, Erroné, Non sourcé}. Un numéro d'article dont tu n'es pas sûr est « Douteux », jamais « Confirmé ».
Ensuite :
## Erreurs ou omissions graves
## Correctifs proposés
## Note de fiabilité (sur 10) et justification en deux phrases
Sois bref, factuel, sans politesse. N'invente aucune référence pour corriger : si tu ne sais pas, écris « à vérifier sur la source officielle ».`;

export function routeAgent(text){
  const t = ' ' + text.toLowerCase() + ' ';
  let best = null, bestScore = 0;
  for (const a of AGENTS) {
    if (a.id === 'auto') continue;
    let s = 0;
    for (const k of a.kw) if (t.includes(k)) s += k.length > 6 ? 2 : 1;
    if (s > bestScore) { bestScore = s; best = a; }
  }
  return bestScore >= 2 ? best : AGENTS[0];
}

export const OFFICIAL_DOMAINS = ['ohada.org','biblio.ohada.org','dgi.gouv.ci','cnps.ci','bceao.int','uemoa.int','cima-afrique.org','cepici.gouv.ci','douanes.ci','gouv.ci','oapi.int','artci.ci','amf-umoa.org','brvm.org','droit-afrique.com','juriscope.org','loidici.biz','courdecassation.ci','anrmp.ci'];

// ————————————————————————————————————————— CATALOGUE DE CONTRATS
export const CONTRACTS = [
  ['bail_com','Bail à usage professionnel (bail commercial)','AUDCG','olivia'],
  ['bail_hab','Bail à usage d\'habitation','Code de la construction et de l\'habitat','olivia'],
  ['bail_constr','Bail à construction','Droit civil / foncier','olivia'],
  ['promesse_vente','Promesse synallagmatique de vente immobilière','Droit civil / foncier','olivia'],
  ['vefa','Vente en l\'état futur d\'achèvement (VEFA)','Code de la construction et de l\'habitat','olivia'],
  ['mandat_gestion','Mandat de gestion immobilière','Droit civil','olivia'],
  ['cdi','Contrat de travail à durée indéterminée','Code du travail 2015','jessica'],
  ['cdd','Contrat de travail à durée déterminée','Code du travail 2015','jessica'],
  ['consultance','Contrat de consultance / prestation intellectuelle','Droit civil et commercial','samantha'],
  ['prestation','Contrat de prestation de services','Droit civil et commercial','samantha'],
  ['fourniture','Contrat de fourniture','AUDCG (vente commerciale)','samantha'],
  ['travaux','Marché privé de travaux (BTP)','Droit civil / construction','olivia'],
  ['sous_traitance','Contrat de sous-traitance','Droit civil et commercial','samantha'],
  ['agence','Contrat d\'agence commerciale / distribution','AUDCG (intermédiaires de commerce)','samantha'],
  ['franchise','Contrat de franchise','Droit commercial / OAPI','rachelle'],
  ['statuts_sarl','Statuts de SARL','AUSCGIE','erika'],
  ['statuts_sas','Statuts de SAS','AUSCGIE','erika'],
  ['pacte','Pacte d\'associés','AUSCGIE','erika'],
  ['cession_parts','Acte de cession de parts sociales (SARL)','AUSCGIE + CGI (enregistrement)','erika'],
  ['cession_actions','Ordre de mouvement / cession d\'actions','AUSCGIE','erika'],
  ['pret','Contrat de prêt / reconnaissance de dette','Droit civil','orin'],
  ['caution','Acte de cautionnement','AUS','orin'],
  ['garantie_auto','Garantie autonome / contre-garantie','AUS','orin'],
  ['nantissement','Nantissement de fonds de commerce / de créances','AUS','orin'],
  ['nda','Accord de confidentialité (NDA)','Droit civil','samantha'],
  ['licence_marque','Contrat de licence de marque','Accord de Bangui révisé','rachelle'],
  ['cession_droits','Cession de droits d\'auteur / logiciel','Loi droit d\'auteur / Accord de Bangui','rachelle'],
  ['transaction','Protocole d\'accord transactionnel','Droit civil (transaction)','samantha'],
  ['honoraires','Convention d\'honoraires d\'avocat','Règlement intérieur du Barreau','samantha'],
  ['consortium','Accord de consortium / groupement','Droit commercial','erika'],
  ['dpa','Accord de traitement de données personnelles','Loi n° 2013-450','sophia'],
];

// ————————————————————————————————————————— PARCOURS D'AUTOMATISATION
export const REGULATIONS = ['AUSCGIE (sociétés)','AUDCG (commercial général, bail)','AUS (sûretés)','AUPSRVE (recouvrement)','Code du travail','CGI / LPF (fiscal)','Code CIMA (assurance)','Foncier et urbanisme','Code de la construction et de l\'habitat','Données personnelles (loi 2013-450)','LBC/FT','Marchés publics','Accord de Bangui (PI)','Réglementation bancaire UMOA'];

export const PROCEDURE_ACTS = ['Mise en demeure','Sommation de payer','Requête aux fins d\'injonction de payer','Exploit d\'opposition à injonction de payer','Assignation en paiement','Assignation en référé','Requête aux fins de saisie conservatoire','Conclusions en défense','Conclusions en réplique','Requête en défense à exécution provisoire','Plainte avec constitution de partie civile','Citation directe','Recours gracieux administratif','Réclamation contentieuse fiscale','Congé (bail)','Procès-verbal d\'assemblée générale'];

export const WORKFLOWS = [
  { id:'doc', group:'Rédaction', icon:'doc', title:'Rédiger un document', desc:'Générez un document à partir d\'un modèle que vous fournissez, adapté au contexte de votre dossier.',
    fields:[['template','docpick','Modèle (document de la base)'],['templateText','textarea','… ou collez le modèle ici'],['context','textarea','Faits et contexte du dossier'],['instr','textarea','Consignes particulières']],
    prompt:v=>`Rédige un document en suivant FIDÈLEMENT la structure, le ton et la mise en forme du modèle ci-dessous, adapté aux faits fournis. Remplace toutes les variables ; signale entre crochets [À COMPLÉTER : …] toute donnée manquante. Ne supprime aucune clause du modèle sans le signaler en fin de document dans une section « Notes du rédacteur ».\n\n<modele>\n${v.templateAll}\n</modele>\n\n<faits>\n${v.context}\n</faits>\n\nConsignes : ${v.instr||'aucune'}` },
  { id:'contract', group:'Rédaction', icon:'contract', title:'Rédiger un contrat', desc:'Générez un contrat à partir d\'un catalogue de modèles, adapté à votre contexte.',
    fields:[['ctype','contract','Type de contrat'],['parties','textarea','Parties (dénomination, forme, siège, RCCM, représentant)'],['key','textarea','Conditions essentielles (objet, prix, durée, garanties…)'],['side','select:Équilibré|Favorable à la première partie|Favorable à la seconde partie','Orientation'],['instr','textarea','Clauses particulières souhaitées']],
    prompt:v=>`Rédige un contrat complet et directement signable : ${v.ctypeLabel} (fondement principal : ${v.ctypeBasis}). Orientation : ${v.side}.\n\nParties :\n${v.parties}\n\nConditions essentielles :\n${v.key}\n\nClauses particulières : ${v.instr||'aucune'}\n\nExigences : préambule ; définitions ; articles numérotés avec intitulés ; toutes les mentions obligatoires du droit applicable (indique en note le texte qui les impose) ; clauses de force majeure, confidentialité, résiliation, droit applicable et règlement des différends (médiation puis juridiction ou arbitrage CCJA/CACI au choix à signaler) ; formalités post-signature (enregistrement, dépôt RCCM, déclaration, visa) ; blocs de signature. Termine par « Notes du rédacteur » listant les points de négociation et les risques, avec niveaux de certitude.` },
  { id:'note', group:'Rédaction', icon:'note', title:'Rédiger une note', desc:'Rédigez une note structurée à partir de vos documents sources.',
    fields:[['ntype','select:Note de consultation|Note interne|Mémo client (langage simple)|Note de synthèse pour audience','Type de note'],['sources','docmulti','Documents sources'],['question','textarea','Question posée / objet de la note'],['dest','text','Destinataire']],
    prompt:v=>`Rédige une ${v.ntype} destinée à ${v.dest||'l\'associé en charge'}, sur la question suivante :\n${v.question}\n\nAppuie-toi en priorité sur les documents sources fournis (cite-les [DOC n]) puis sur les textes applicables. En-tête : destinataire, objet, date, référence. Respecte la structure d'analyse et les niveaux de certitude.` },
  { id:'summary', group:'Analyse', icon:'search', title:'Résumer un document', desc:'Obtenez un résumé clair des points clés de votre document.',
    fields:[['doc','docpick','Document'],['len','select:Synthèse en 10 lignes|Résumé détaillé (1-2 pages)|Fiche de lecture pour l\'associé','Format']],
    prompt:v=>`Produis : ${v.len} du document fourni. Structure : nature de l'acte et parties ; objet ; obligations principales de chaque partie ; montants et échéances (tableau) ; clauses sensibles ou inhabituelles ; risques pour notre client ; points à vérifier. Cite les clauses par leur numéro.` },
  { id:'extract', group:'Analyse', icon:'pen', title:'Extraire des informations juridiques', desc:'Identifiez rapidement les informations, clauses et éléments juridiques clés d\'un document.',
    fields:[['doc','docpick','Document'],['fields','textarea','Éléments à extraire (un par ligne)', 'Parties et représentants\nDate et lieu de signature\nObjet\nPrix / montants\nDurée et date d\'effet\nConditions suspensives\nGaranties et sûretés\nPénalités\nRésiliation\nDroit applicable et juridiction\nObligations de confidentialité\nFormalités à accomplir']],
    prompt:v=>`Extrais du document les éléments suivants et présente-les dans un tableau Markdown | Élément | Valeur extraite | Clause / page | Observation |. Si un élément est absent, écris « Non stipulé » (n'invente rien). Éléments :\n${v.fields}\n\nPuis une section « Anomalies détectées » (incohérences de dates, montants, parties, renvois).` },
  { id:'audit', group:'Analyse', icon:'shield', title:'Auditer la conformité d\'un document', desc:'Obtenez un verdict de conformité clause par clause au regard des réglementations choisies, exporté en tableur.', json:true,
    fields:[['doc','docpick','Document à auditer'],['regs','checks','Réglementations de référence'],['side','text','Client du cabinet (pour apprécier les risques)']],
    prompt:v=>`Audite la conformité du document, clause par clause, au regard de : ${v.regs}. Client : ${v.side||'non précisé'}.\nRéponds UNIQUEMENT par un tableau JSON valide (sans texte autour, sans balises de code), chaque élément ayant exactement ces clés :\n{"clause":"n° ou intitulé","extrait":"citation courte","reference":"texte et article applicable","verdict":"Conforme|Non conforme|À risque|À vérifier","gravite":"Faible|Moyenne|Élevée","analyse":"2 phrases maximum","recommandation":"rédaction ou action proposée","certitude":"Vérifié|Connaissance établie|À vérifier"}\nAjoute en dernier élément les mentions obligatoires ABSENTES du document (clause = "Clause manquante").` },
  { id:'review', group:'Révision', icon:'check', title:'Réviser un document', desc:'Appliquez vos commentaires à un document et obtenez une version révisée avec un journal des modifications.',
    fields:[['doc','docpick','Document à réviser'],['comments','textarea','Vos commentaires et instructions de révision'],['mode','select:Révision ciblée (seulement les commentaires)|Révision complète (commentaires + améliorations juridiques)','Étendue']],
    prompt:v=>`Révise le document selon : ${v.mode}.\nCommentaires du juriste :\n${v.comments}\n\nRends exactement deux sections :\n## Version révisée\n(le texte intégral révisé, prêt à l'emploi)\n## Journal des modifications\n| # | Clause | Texte initial (extrait) | Texte révisé (extrait) | Motif / fondement |` },
  { id:'compare', group:'Analyse', icon:'compare', title:'Analyse comparée', desc:'Comparez deux versions ou deux contrats et mesurez l\'impact juridique des écarts.',
    fields:[['docA','docpick','Document A (référence)'],['docB','docpick','Document B (à comparer)'],['side','text','Point de vue (client)']],
    prompt:v=>`Compare le document A (référence) et le document B. Point de vue : ${v.side||'neutre'}.\nTableau | Clause | Document A | Document B | Impact juridique | Favorable à | Recommandation |, puis « Clauses ajoutées », « Clauses supprimées », « Synthèse des risques » et « Position de négociation conseillée ».` },
  { id:'deadlines', agent:'louis', group:'Contentieux et délais', icon:'clock', title:'Chronologie et délais', desc:'Extrait la chronologie d\'un dossier et calcule les délais de procédure ; export vers l\'agenda du téléphone.', json:true,
    fields:[['sources','docmulti','Pièces du dossier'],['facts','textarea','Faits complémentaires (dates de signification, audiences…)']],
    prompt:v=>`À partir des pièces et des faits, établis la chronologie et les délais à surveiller. Faits complémentaires :\n${v.facts||'aucun'}\nRéponds UNIQUEMENT par un JSON valide (sans texte autour, sans balises de code) :\n{"chronologie":[{"date":"AAAA-MM-JJ","evenement":"…","source":"DOC n ou faits"}],"delais":[{"intitule":"…","point_de_depart":"AAAA-MM-JJ","duree":"…","echeance":"AAAA-MM-JJ ou null","fondement":"texte et article","certitude":"Vérifié|Connaissance établie|À vérifier","action":"acte à accomplir"}],"observations":"…"}\nN'invente jamais un délai : si la durée est incertaine, mets certitude "À vérifier" et explique dans observations. Tiens compte des délais de distance quand ils s'appliquent.` },
  { id:'act', agent:'louis', group:'Contentieux et délais', icon:'gavel', title:'Acte de procédure', desc:'Mise en demeure, requête, assignation, conclusions… avec les mentions obligatoires.',
    fields:[['atype','select:'+PROCEDURE_ACTS.join('|'),'Type d\'acte'],['juridiction','text','Juridiction / destinataire'],['facts','textarea','Faits, prétentions, montants'],['sources','docmulti','Pièces à viser']],
    prompt:v=>`Rédige l'acte suivant, prêt à être signifié ou déposé : ${v.atype}. Juridiction / destinataire : ${v.juridiction||'à préciser'}.\nFaits et prétentions :\n${v.facts}\n\nExigences : toutes les mentions obligatoires prescrites à peine de nullité (indique entre parenthèses le texte qui les impose), exposé des faits, discussion en droit avec articles, dispositif / demandes chiffrées, bordereau des pièces numéroté. Termine par « Notes du rédacteur » : délais à respecter, mode de délivrance, coûts estimés, points à vérifier.` },
  { id:'dd', agent:'erika', group:'Contentieux et délais', icon:'list', title:'Due diligence et check-list', desc:'Liste des pièces, vérifications et risques pour une opération (acquisition, création, financement…).',
    fields:[['op','textarea','Opération envisagée'],['client','text','Client et rôle (acquéreur, prêteur…)']],
    prompt:v=>`Établis la check-list de due diligence pour l'opération suivante :\n${v.op}\nClient : ${v.client||'non précisé'}.\nTableau | # | Vérification / pièce | Où l'obtenir (registre, administration) | Délai et coût indicatifs | Fondement | Risque si absent |. Puis « Conditions suspensives à prévoir », « Garanties à exiger » et « Calendrier type ».` },
];

// ————————————————————————————————————————— MODÈLES DE DOSSIERS
export const DOSSIER_TEMPLATES = [
  { id:'t_bail', title:'Contentieux du bail commercial', matiere:'Bail / AUDCG', agent:'olivia',
    steps:['Analyser le bail et ses avenants','Vérifier la qualité de bailleur (titre, mandat)','Mise en demeure par commissaire de justice (délai d\'un mois)','Tentative de règlement amiable préalable (juridiction de commerce)','Assignation en résiliation / paiement / expulsion','Suivi de l\'exécution'],
    pieces:['Bail et avenants','Quittances et relevés de loyers','Titre de propriété ou mandat du bailleur','Mises en demeure et exploits','Correspondances','PV de constat'] },
  { id:'t_ip', title:'Recouvrement par injonction de payer', matiere:'Recouvrement / AUPSRVE', agent:'louis',
    steps:['Vérifier que la créance est certaine, liquide et exigible','Requête aux fins d\'injonction de payer','Signification de l\'ordonnance','Surveiller le délai d\'opposition (15 jours + distance)','Apposition de la formule exécutoire','Saisie-attribution ou saisie-vente'],
    pieces:['Titre de la créance (facture, contrat, reconnaissance)','Bons de livraison / PV de réception','Relances et mises en demeure','Extrait RCCM du débiteur'] },
  { id:'t_sarl', title:'Création de société (SARL / SAS)', matiere:'Sociétés / AUSCGIE', agent:'erika',
    steps:['Choix de la forme et du capital','Rédaction des statuts et déclaration de souscription','Dépôt des fonds','Formalités CEPICI (RCCM, DFE, CNPS)','Publication / annonce légale','Ouverture des registres'],
    pieces:['Pièces d\'identité des associés et dirigeants','Casier judiciaire du gérant','Justificatif du siège (bail ou titre)','Certificat de dépôt des fonds','Statuts signés'] },
  { id:'t_cession', title:'Cession de parts sociales', matiere:'Sociétés + fiscal', agent:'erika',
    steps:['Audit de la société cible','Agrément des cessionnaires','Acte de cession','Enregistrement et droits','Modification des statuts','Dépôt au RCCM et opposabilité'],
    pieces:['Statuts à jour','Extrait RCCM','États financiers des 3 derniers exercices','Attestations fiscale et CNPS','PV d\'agrément'] },
  { id:'t_licenciement', title:'Licenciement (personnel / économique)', matiere:'Travail', agent:'jessica',
    steps:['Qualifier le motif','Demande d\'explications / entretien','Notification motivée','Calcul du préavis et des indemnités','Certificat de travail et solde de tout compte','Gestion du contentieux (inspection, tribunal du travail)'],
    pieces:['Contrat et avenants','Bulletins de paie','Pièces disciplinaires','Correspondances','Convention collective applicable'] },
  { id:'t_foncier', title:'Acquisition foncière urbaine (ACD / titre foncier)', matiere:'Foncier', agent:'olivia',
    steps:['Vérification de la chaîne des titres','État foncier et recherche de charges','Promesse de vente','Acte notarié de vente','Mutation au livre foncier','Suivi de l\'ACD / du titre'],
    pieces:['Lettre d\'attribution / ACD / titre foncier','Plan et extrait topographique','État foncier','Pièces d\'identité des vendeurs','Quitus fiscal'] },
  { id:'t_fiscal', title:'Contrôle et contentieux fiscal', matiere:'Fiscal', agent:'harvey',
    steps:['Analyse de l\'avis de vérification','Réponse à la notification de redressement (dans le délai)','Réclamation contentieuse','Recours juridictionnel','Sursis de paiement / garanties'],
    pieces:['Avis de vérification','Notifications de redressement','Déclarations et états financiers','Pièces justificatives','Correspondances avec la DGI'] },
  { id:'t_penal', title:'Plainte pénale (affaires)', matiere:'Pénal', agent:'daniel',
    steps:['Qualification des faits et éléments constitutifs','Vérification de la prescription','Plainte simple ou avec constitution de partie civile','Consignation','Suivi de l\'instruction','Audience et voies de recours'],
    pieces:['Pièces établissant les faits','Correspondances','Expertises / constats','Preuve du préjudice'] },
];

// ————————————————————————————————————————— BANC D'ESSAI (tests hebdomadaires)
export const DEFAULT_TESTS = [
  { q:'Dans quel délai former opposition à une décision portant injonction de payer dans l\'espace OHADA, et à partir de quand ?', expect:['15 jours','signification'], agent:'louis' },
  { q:'Quel est le taux normal de TVA en Côte d\'Ivoire ?', expect:['18'], agent:'harvey' },
  { q:'Quel Acte uniforme régit le bail à usage professionnel ?', expect:['AUDCG'], agent:'olivia' },
  { q:'Quelle juridiction statue en cassation sur les affaires soulevant des questions relatives aux Actes uniformes OHADA ?', expect:['CCJA'], agent:'erika' },
  { q:'Quelle loi constitue le Code du travail ivoirien en vigueur ?', expect:['2015-532'], agent:'jessica' },
  { q:'Quel texte fonde le régime du domaine foncier rural en Côte d\'Ivoire ?', expect:['98-750'], agent:'olivia' },
  { q:'Quel texte régit la propriété industrielle dans les États membres de l\'OAPI ?', expect:['Bangui'], agent:'rachelle' },
  { q:'Quelle loi institue le Code pénal ivoirien actuellement applicable ?', expect:['2019-574'], agent:'daniel' },
  { q:'Quel article du Code CIMA fixe le taux de la patente des pharmacies à Abidjan ?', expect:[], refusal:true, agent:'marvin' },
];

export const REFUSAL_MARKERS = ['ne traite','ne régit','ne prévoit','aucune disposition','aucun article','pas de disposition','pas de base','ne contient','hors du champ','ne relève pas','ne fixe pas','ne fixe aucun','n\'est pas régi','pas l\'objet'];
