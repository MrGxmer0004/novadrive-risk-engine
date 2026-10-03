import pandas as pd, numpy as np, collections, json
x = pd.read_excel('Samanvay_Consularium_NovaDrive_Data_1.xlsx', sheet_name=None)
su = x['Supplier Universe']; ind = x['Supplier business Indicators'].set_index('Entity ID')
ID = {'Aster':'ORG-247','Boreal':'ORG-725','Cobalt':'ORG-119','Delta Capacitor':'ORG-922','Estuary':'ORG-786','ForgeLine':'ORG-287','Grove':'ORG-103','HarborSense':'ORG-176',
'IonPeak':'ORG-439','Jade':'ORG-453','Kestrel':'ORG-728','Lumen':'ORG-942','Meridian':'ORG-210','Nacre':'ORG-849','Orion':'ORG-708','Pine':'ORG-274','Quartz':'ORG-329','Rill':'ORG-469',
'Umber':'ORG-455','Verdant':'ORG-736','Warden':'ORG-873','Xenon':'ORG-179','Yarrow':'ORG-520','Zenith':'ORG-659'}
# sanity: names match
for k,v in ID.items(): assert su.set_index('Entity ID').loc[v,'Legal Name'].startswith(k.split()[0]), (k,v)
zone = dict(zip(su['Entity ID'],su['Facility Zone'])); site=dict(zip(su['Entity ID'],su['Primary Facility ID']))
rev = {'P1':624,'P2':520,'P3':416}
comp_prod = {'M10':['P1','P3'],'M20':['P2'],'C10':['P1','P2','P3'],'C20':['P1','P2'],'H10':['P1'],'H20':['P2','P3'],'B10':['P3']}
lead = {'M10':16,'M20':16,'C10':12,'C20':8,'H10':4,'H20':6,'B10':12}
t1 = {'M10':{'Aster':.6,'Boreal':.4},'M20':{'Aster':.7,'Boreal':.3},'C10':{'Cobalt':1},'C20':{'Delta Capacitor':1},'H10':{'ForgeLine':1},'H20':{'Estuary':1},'B10':{'Grove':.8,'HarborSense':.2}}
up = [('IonPeak','Aster'),('IonPeak','Boreal'),('Lumen','Aster'),('Lumen','Boreal'),('Orion','Aster'),('Orion','Boreal'),
 ('Jade','Cobalt'),('Jade','Grove'),('Jade','HarborSense'),('Kestrel','Cobalt'),('Kestrel','Grove'),('Rill','Cobalt'),
 ('Meridian','Delta Capacitor'),('Nacre','Delta Capacitor'),('Pine','Estuary'),('Quartz','ForgeLine'),
 ('Umber','IonPeak'),('Verdant','IonPeak'),('Yarrow','Orion'),('Warden','Jade'),('Xenon','Jade'),('Zenith','Meridian')]
T1 = sorted({s for d in t1.values() for s in d})
T2 = sorted({s for s,c in up if c in T1}); T3 = sorted({s for s,c in up if c in T2})
tier = {**{n:1 for n in T1},**{n:2 for n in T2},**{n:3 for n in T3}}
cust = collections.defaultdict(set)
for s,c in up: cust[s].add(c)
def comps(n):
    out={c for c,d in t1.items() if n in d}
    for u in cust.get(n,[]): out|=comps(u)
    return out
def t1reach(n):
    if n in T1: return {n}
    o=set()
    for u in cust[n]: o|=t1reach(u)
    return o
sole_conf = {'Cobalt','Delta Capacitor','Estuary','ForgeLine','IonPeak','Jade'}
share = {'Aster':988/1560,'Boreal':572/1560,'Grove':.8,'HarborSense':.2}
conf = {**{n:'High' for n in T1+['IonPeak','Jade']}, **{n:'Medium' for n in T2+T3 if n not in('IonPeak','Jade')}, 'Verdant':'Low'}
def sc(v,lo,hi): return float(np.clip((v-lo)/(hi-lo),0,1)*100)
net = ind.loc[list(ID.values())]
imp = dict(cr=net['Current Ratio'].quantile(.25), nd=net['Net Debt / EBITDA'].quantile(.75), ag=net['Assurance Gap Index'].quantile(.75))
rows=[]
for n,e in ID.items():
    r=ind.loc[e]; cs=comps(n); ps=sorted({p for c in cs for p in comp_prod[c]}); rv=sum(rev[p] for p in ps)
    crit = rv/1560*100
    if n in sole_conf: status,ss='Confirmed sole',100
    elif n in share: status,ss='Second source qualified',10+40*share[n]
    else: status,ss='Exclusivity not stated',60
    lt = max(lead[c] for c in cs)
    subst = .7*ss+.3*lt/16*100
    netdep = 50*len(t1reach(n))/3 + 50*len(cs)/2
    impact = .4*crit+.4*subst+.2*netdep
    imputed = pd.isna(r['Current Ratio'])
    cr = imp['cr'] if imputed else r['Current Ratio']; nd = imp['nd'] if imputed else r['Net Debt / EBITDA']; ag = imp['ag'] if imputed else r['Assurance Gap Index']
    fin=(sc(-cr,-2,-.8)+sc(nd,1,6))/2
    op=(sc(-r['Shipment Timeliness - 3M Avg (%)'],-95,-75)+sc(-r['Timeliness Change - Jan To Latest (pp)'],-2,10))/2
    geo=(r['Physical Hazard Index']+r['Logistics Friction Index']+r['Infrastructure Index'])/3
    vul=.3*fin+.3*op+.2*geo+.2*ag
    rows.append(dict(supplier=n,tier=tier[n],zone=zone[e],site=site[e],components='/'.join(sorted(cs)),products='/'.join(ps),rev=rv,status=status,lead=lt,
        crit=crit,subst=subst,netdep=netdep,impact=impact,fin=fin,op=op,geo=geo,assur=ag,vul=vul,imputed=imputed,conf=conf[n],
        prio=.5*impact+.5*vul, gm=(impact*vul)**.5))
R=pd.DataFrame(rows)
R['rank']=R['prio'].rank(ascending=False,method='min').astype(int)
R['rank_gm']=R['gm'].rank(ascending=False,method='min').astype(int)
R=R.sort_values('prio',ascending=False)
pd.set_option('display.width',250); pd.set_option('display.max_columns',40)
print(R[['rank','rank_gm','supplier','tier','zone','components','rev','status','lead','crit','subst','netdep','impact','fin','op','geo','assur','vul','prio','gm','imputed','conf']].round(0).to_string(index=False))
R.to_csv('rank.csv',index=False); print(imp)
