import json, mimetypes, os, re, shutil, sqlite3
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / 'data' / 'archive.db'
MANIFEST_PATH = ROOT / 'data' / 'works-import-manifest.json'
SITE_ROOT = ROOT.parents[1]
SOURCE_ROOT = SITE_ROOT / '\u5236\u4f5c\u7f51\u7ad9\u7d20\u6750\u56fe\u7247' / '01-\u539f\u59cb\u4f5c\u54c1\u5e93'
OUT_DIR = ROOT / 'public' / 'recovered'

def repair_text(value):
    if value is None: return ''
    if not isinstance(value, str): return value
    candidates = [value]
    for enc in ('gbk','cp936'):
        try: candidates.append(value.encode(enc, errors='ignore').decode('utf-8', errors='ignore'))
        except Exception: pass
    def score(text): return sum('\u4e00' <= ch <= '\u9fff' for ch in text) - text.count('\ufffd')*3 - text.count('?')
    return max(candidates, key=score)

def rowdict(row): return {k: repair_text(row[k]) for k in row.keys()}
def safe_name(name): return (re.sub(r'[^A-Za-z0-9._-]+','-',name).strip('-') or 'media')[:90]
def flag(v): return 1 if v is True or v == 1 else 0

def collect_files():
    files=[]
    for base in (SOURCE_ROOT, ROOT/'public'/'assets', ROOT/'legacy'):
        if not base.exists(): continue
        for p in base.rglob('*'):
            if p.is_file() and 'node_modules' not in str(p):
                try: files.append({'path':p,'name':p.name,'size':p.stat().st_size,'suffix':p.suffix.lower()})
                except OSError: pass
    return files

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect('file:' + DB_PATH.as_posix() + '?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    settings = {repair_text(r['key']): repair_text(r['value']) for r in cur.execute('select * from settings')}
    categories = [rowdict(r) for r in cur.execute('select * from categories order by sort_order, id')]
    projects = [rowdict(r) for r in cur.execute('select * from projects order by sort_order, id')]
    media = [rowdict(r) for r in cur.execute('select * from media order by sort_order, id')]
    tags = [rowdict(r) for r in cur.execute('select * from tags order by id')]
    project_tags = [rowdict(r) for r in cur.execute('select * from project_tags')]
    media_tags = [rowdict(r) for r in cur.execute('select * from media_tags')]
    manifest_items=[]
    if MANIFEST_PATH.exists(): manifest_items=json.loads(MANIFEST_PATH.read_text(encoding='utf-8-sig')).get('items',[])
    files=collect_files(); by_size={}; by_name={}
    for f in files:
        by_size.setdefault(f['size'],[]).append(f); by_name.setdefault(f['name'].lower(),[]).append(f)
    manifest_by_output={i.get('output'):i for i in manifest_items if i.get('output')}
    path_map={}; matched=0
    for item in media:
        old=item.get('file_path') or ''; found=None; mi=manifest_by_output.get(old)
        if mi:
            original=str(mi.get('originalName') or '').lower(); size=mi.get('sourceBytes'); c=[]; c+=by_name.get(original,[]); c+=by_size.get(size,[])
            if c: found=sorted(c,key=lambda f:(f['name'].lower()!=original,f['size']!=size,len(str(f['path']))))[0]['path']
        if not found and item.get('original_name'):
            c=by_name.get(str(item.get('original_name')).lower(),[])
            if c: found=sorted(c,key=lambda f:len(str(f['path'])))[0]['path']
        if not found and item.get('size'):
            c=by_size.get(int(item.get('size') or 0),[])
            if c: found=sorted(c,key=lambda f:len(str(f['path'])))[0]['path']
        if found and found.exists():
            ext=found.suffix.lower() or mimetypes.guess_extension(str(item.get('mime_type') or '')) or '.jpg'
            dst=OUT_DIR / (str(item.get('id','x')) + '-' + safe_name(found.stem) + ext)
            if not dst.exists() or dst.stat().st_size != found.stat().st_size: shutil.copy2(found,dst)
            path_map[old]='/recovered/' + dst.name; item['file_path']=path_map[old]; item['storage_path']=''; matched+=1
        elif old.startswith('/uploads/'):
            item['file_path']=''
    for arr,key in ((projects,'cover_image'),(categories,'cover_image')):
        for item in arr:
            v=item.get(key) or ''
            if v in path_map: item[key]=path_map[v]
            elif v.startswith('/uploads/'): item[key]=''
    for k,v in list(settings.items()):
        if v in path_map: settings[k]=path_map[v]
        elif isinstance(v,str) and v.startswith('/uploads/'): settings[k]=''
    settings['site_name']=settings.get('site_name') or '\u5c71\u5ddd\u884c\u6b62'
    settings['hero_title']=settings.get('hero_title') or '\u5c71\u5ddd\u884c\u6b62'
    settings['hero_subtitle']=settings.get('hero_subtitle') or '\u6444\u5f71 / \u5e73\u9762\u8bbe\u8ba1 / \u7a7a\u95f4 / \u65e5\u5e38\u7814\u7a76'
    cat_by_id={c.get('id'):c for c in categories}; proj_by_id={p.get('id'):p for p in projects}
    for p in projects:
        c=cat_by_id.get(p.get('category_id')); p['category_name']=c.get('name') if c else ''; p['category_slug']=c.get('slug') if c else ''
    for m in media:
        c=cat_by_id.get(m.get('category_id')); p=proj_by_id.get(m.get('project_id'))
        m['category_name']=c.get('name') if c else ''; m['category_slug']=c.get('slug') if c else ''
        m['project_title']=p.get('title') if p else ''; m['project_slug']=p.get('slug') if p else ''; m['project_year']=p.get('year') if p else ''; m['project_location']=p.get('location') if p else ''
    hero=next((m for m in media if flag(m.get('is_hero')) and m.get('file_path')), None)
    if not settings.get('hero_media'):
        settings['hero_media']=hero.get('file_path') if hero else '/assets/hero-default.jpg'; settings['hero_media_type']=hero.get('media_type') if hero else 'image'
    home={'settings':settings,'hero':hero or {'file_path':settings.get('hero_media','/assets/hero-default.jpg'),'media_type':settings.get('hero_media_type','image')},'featured':[p for p in projects if flag(p.get('is_featured'))],'recommended':[p for p in projects if flag(p.get('is_series')) and flag(p.get('is_recommended'))],'categories':[{**c,'project_count':sum(1 for p in projects if p.get('category_id')==c.get('id') and p.get('status')=='published')} for c in categories if flag(c.get('is_primary'))],'database_preview':[m for m in media if flag(m.get('show_in_database')) and m.get('file_path')][:12]}
    payload={'settings':settings,'categories':categories,'projects':projects,'media':media,'tags':tags,'project_tags':project_tags,'media_tags':media_tags,'home':home,'matched_media':matched,'total_media':len(media)}
    output='/* Auto-generated recovery data from old SQLite archive. */\n'
    output+='export const recoveredArchive = JSON.parse('
    output+=json.dumps(json.dumps(payload, ensure_ascii=False), ensure_ascii=True)
    output+=') as any;\n\n'
    output+='''export function getRecoveredSettings() { return recoveredArchive.settings as Record<string, string>; }\nexport function getRecoveredHomePayload() { return recoveredArchive.home as any; }\nexport function getRecoveredCategories() { return recoveredArchive.categories as unknown as any[]; }\nexport function getRecoveredProjects() { return recoveredArchive.projects as unknown as any[]; }\nexport function getRecoveredMedia() { return recoveredArchive.media as unknown as any[]; }\nexport function getRecoveredTags() { return recoveredArchive.tags as unknown as any[]; }\nexport function getRecoveredInspirationConfig() {\n  const settings = getRecoveredSettings();\n  try { return { tree: JSON.parse(settings.inspiration_tree_json || "null"), assignments: JSON.parse(settings.inspiration_resource_map_json || "{}") }; }\n  catch { return { tree: null, assignments: {} }; }\n}\n'''
    (ROOT/'lib'/'recovered-data.ts').write_text(output, encoding='utf-8')
    print(json.dumps({'matched':matched,'total':len(media),'out':str(OUT_DIR)}, ensure_ascii=False))
if __name__ == '__main__': main()
