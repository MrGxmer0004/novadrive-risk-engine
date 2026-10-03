import pandas as pd, numpy as np, json
x = pd.read_excel('Samanvay_Consularium_NovaDrive_Data_1.xlsx', sheet_name=None)
su = x['Supplier Universe'].set_index('Entity ID'); ind = x['Supplier business Indicators'].set_index('Entity ID')
ev = x['Relationship Evidence']; ef = x['Risk Event Flags']; cc = x['Components Context']; bc = x['Business Context'].dropna(how='all')
R = pd.read_csv('rank.csv').set_index('supplier')
ID = {'Aster':'ORG-247','Boreal':'ORG-725','Cobalt':'ORG-119','Delta Capacitor':'ORG-922','Estuary':'ORG-786','ForgeLine':'ORG-287','Grove':'ORG-103','HarborSense':'ORG-176',
'IonPeak':'ORG-439','Jade':'ORG-453','Kestrel':'ORG-728','Lumen':'ORG-942','Meridian':'ORG-210','Nacre':'ORG-849','Orion':'ORG-708','Pine':'ORG-274','Quartz':'ORG-329','Rill':'ORG-469',
'Umber':'ORG-455','Verdant':'ORG-736','Warden':'ORG-873','Xenon':'ORG-179','Yarrow':'ORG-520','Zenith':'ORG-659'}
cat = {'Aster':'power_assembly','Boreal':'power_assembly','IonPeak':'dies','Lumen':'cores','Orion':'ceramic','Umber':'sic_wafer','Verdant':'gases','Yarrow':'minerals','Cobalt':'control_board','Jade':'pcb','Kestrel':'mcu','Rill':'connectors','Warden':'copper_foil','Xenon':'resin','Delta Capacitor':'dclink','Meridian':'film','Nacre':'alfoil','Zenith':'polymer','Estuary':'cooling','Pine':'thermal_metals','ForgeLine':'housing','Quartz':'al_alloy','Grove':'bms','HarborSense':'bms'}
supplies = {'Aster':'Power assemblies M10, M20','Boreal':'Power assemblies M10, M20','Cobalt':'Control board C10','Delta Capacitor':'DC-link capacitor C20','Estuary':'Cooling assembly H20','ForgeLine':'Protective housing H10','Grove':'Battery-monitoring board B10','HarborSense':'Battery-monitoring board B10',
'IonPeak':'Power semiconductor dies','Jade':'Printed circuit substrates','Kestrel':'Microcontrollers','Lumen':'Magnetic cores','Meridian':'Dielectric film','Nacre':'Aluminum foil','Orion':'Ceramic substrates','Pine':'Thermal metals','Quartz':'Aluminum alloy','Rill':'Connectors',
'Umber':'Silicon-carbide wafers','Verdant':'Process gases','Warden':'Copper foil','Xenon':'Resin','Yarrow':'Specialty minerals','Zenith':'Polymer'}
def f(v): return None if pd.isna(v) else float(v)
sup=[]
for k,e in ID.items():
    r=R.loc[k]; i=ind.loc[e]; s=su.loc[e]
    sup.append(dict(key=k,id=e,legal=s['Legal Name'],tier=int(r.tier),zone=s['Facility Zone'],site=s['Primary Facility ID'],market=s['Registered Market'],supplies=supplies[k],cat=cat[k],
      x=round(1-r.vul/100,3),sub=dict(fin=round(1-r.fin/100,3),op=round(1-r.op/100,3),geo=round(1-r.geo/100,3),assur=round(1-r.assur/100,3)),imputed=bool(r.imputed),conf=r.conf,
      raw=dict(cr=f(i['Current Ratio']),nd=f(i['Net Debt / EBITDA']),tim=f(i['Shipment Timeliness - 3M Avg (%)']),chg=f(i['Timeliness Change - Jan To Latest (pp)']),ag=f(i['Assurance Gap Index']),haz=f(i['Physical Hazard Index']),log=f(i['Logistics Friction Index']),inf=f(i['Infrastructure Index'])),
      note=(s['Other Known Site / Note'] if isinstance(s['Other Known Site / Note'],str) else None)))
L=[('IonPeak','Aster','Power semiconductor dies','sole',['DOC-021','DOC-077','DOC-078','SHP-00125']),('IonPeak','Boreal','Power semiconductor dies','sole',['DOC-023','DOC-077','DOC-078']),
('Lumen','Aster','Magnetic cores','unstated',['DOC-035']),('Lumen','Boreal','Magnetic cores','unstated',['DOC-037']),('Orion','Aster','Ceramic substrates','unstated',['DOC-043']),('Orion','Boreal','Ceramic substrates','unstated',['DOC-045']),
('Jade','Cobalt','Printed circuit substrates','sole',['DOC-025','DOC-079','DOC-076']),('Jade','Grove','Printed circuit substrates','sole',['DOC-027','DOC-079','DOC-076']),('Jade','HarborSense','Printed circuit substrates','sole',['DOC-029','DOC-079','DOC-076']),
('Kestrel','Cobalt','Microcontrollers','unstated',['DOC-031']),('Kestrel','Grove','Microcontrollers','unstated',['DOC-033']),('Rill','Cobalt','Connectors','unstated',['DOC-051']),
('Meridian','Delta Capacitor','Dielectric film','unstated',['DOC-039']),('Nacre','Delta Capacitor','Aluminum foil','unstated',['DOC-041']),('Pine','Estuary','Thermal metals','unstated',['DOC-047']),('Quartz','ForgeLine','Aluminum alloy','unstated',['DOC-049']),
('Umber','IonPeak','Silicon-carbide wafers','unstated',['DOC-056']),('Verdant','IonPeak','Process gases','candidate',['DOC-058']),('Yarrow','Orion','Specialty minerals','unstated',['DOC-066']),
('Warden','Jade','Copper foil','unstated',['DOC-060']),('Xenon','Jade','Resin','unstated',['DOC-064']),('Zenith','Meridian','Polymer','unstated',['DOC-070'])]
links=[dict(frm=a,to=b,input=c,type=t,ev=e) for a,b,c,t,e in L]
t1ev={'Aster':{'M10':['DOC-001','DOC-002','SHP-00002'],'M20':['DOC-003','DOC-004']},'Boreal':{'M10':['DOC-005','DOC-006','SHP-00025'],'M20':['DOC-007','DOC-008']},'Cobalt':{'C10':['DOC-009','DOC-010','SHP-00050']},'Delta Capacitor':{'C20':['DOC-011','DOC-012','SHP-00062']},
'Estuary':{'H20':['DOC-013','DOC-014']},'ForgeLine':{'H10':['DOC-015','DOC-016']},'Grove':{'B10':['DOC-017','DOC-018']},'HarborSense':{'B10':['DOC-019','DOC-020']}}
t1 = {'M10':{'Aster':.6,'Boreal':.4},'M20':{'Aster':.7,'Boreal':.3},'C10':{'Cobalt':1},'C20':{'Delta Capacitor':1},'H10':{'ForgeLine':1},'H20':{'Estuary':1},'B10':{'Grove':.8,'HarborSense':.2}}
comp_prod = {'M10':['P1','P3'],'M20':['P2'],'C10':['P1','P2','P3'],'C20':['P1','P2'],'H10':['P1'],'H20':['P2','P3'],'B10':['P3']}
comps=[]
for _,r in cc.iterrows():
    c=r['Component ID']
    comps.append(dict(id=c,name=r['Component Name'],app=r['Key application'],lead=int(r['Indicative supplier Qualification Lead Time (Weeks)']),criteria=r['Key Criteria for Alternate Supplier Search'],products=comp_prod[c],suppliers=t1[c],ev={s:t1ev[s][c] for s in t1[c]}))
plants={'P1':{'Harbor Works':.6,'Plateau Works':.4},'P2':{'Harbor Works':.3,'Coastal Works':.7},'P3':{'Plateau Works':1}}
prods=[dict(id=r['Product ID'],name=r['Product Name'],rev=int(r['Annual Revenue (USD m)']),units=int(r['Weekly Units']),plants=plants[r['Product ID']]) for _,r in bc.iterrows()]
evid=[dict(id=r['Evidence ID'],date=str(r['Evidence Date'])[:10],type=r['Evidence Type'],family=r['Source Family ID'],title=r['Title / Parties'],detail=r['Evidence Detail'],status=r['Record Status']) for _,r in ev.iterrows()]
events=[dict(id=r['Event ID'],published=str(r['Published At'])[:10],effective=str(r['Effective At'])[:10],title=r['Title'],detail=r['Event Detail'],family=r['Source Family ID']) for _,r in ef.iterrows()]
universe=[dict(id=e,legal=r['Legal Name'],type=r['Entity Type'],zone=r['Facility Zone'],site=r['Primary Facility ID'],siteName=r['Primary Facility Name'],role=r['Facility Role'],note=(r['Other Known Site / Note'] if isinstance(r['Other Known Site / Note'],str) else None)) for e,r in su.iterrows()]
zones={'Z01':'East Delta','Z02':None,'Z03':None,'Z04':None,'Z05':'Western Ridge','Z06':None,'Z07':'Harbor District','Z08':None}
zidx={z:dict(haz=float(g['Physical Hazard Index'].iloc[0]),log=float(g['Logistics Friction Index'].iloc[0]),inf=float(g['Infrastructure Index'].iloc[0])) for z,g in su.join(ind,rsuffix='_i').groupby('Facility Zone')}
excluded=[dict(what='Solace Optics to Grove',treat='Hypothesis',why='Sample evaluation only; no serial-production award.',ev=['DOC-085']),
 dict(what='Alder Bauxite to Quartz Alloy',treat='Research lead',why='Shared trade directory; no purchase link stated.',ev=['DOC-074','DOC-086']),
 dict(what='Delta Capacitor housings',treat='Excluded',why='Pilot program that ended 31 December 2023.',ev=['DOC-080']),
 dict(what='Delta Consumer Plastics (ORG-857)',treat='Excluded',why='Different legal entity; packaging trial never became an award.',ev=['DOC-084','SHP-00438']),
 dict(what='Ion Peak Trading (ORG-309)',treat='Excluded',why='Unrelated broker, registry REG-NO-4128.',ev=['DOC-077']),
 dict(what='Harbor Freight Services (ORG-328)',treat='Logistics node',why='Consolidator on the die shipment to Aster; manufactures nothing.',ev=['DOC-083','SHP-00125']),
 dict(what='CommonSpan Holdings (ORG-268)',treat='Ownership node',why='Parent of Aster and Boreal; not a supplier.',ev=['DOC-075']),
 dict(what='Jade Circuits Holdings (ORG-445)',treat='Ownership node',why='Accounting parent of Jade Printed Circuits.',ev=['DOC-076']),
 dict(what='IonPeak SITE-900 (Z05)',treat='Excluded',why='Research and pilot line on a different process; not a qualified backup.',ev=['DOC-077'])]
D=dict(suppliers=sup,links=links,components=comps,products=prods,evidence=evid,events=events,universe=universe,zones=zones,zoneIndex=zidx,excluded=excluded,cutoff='2025-09-30')
json.dump(D,open('../data/data.json','w'),ensure_ascii=False)
print(len(json.dumps(D)), len(sup), len(links), len(evid))
