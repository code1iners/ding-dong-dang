# PROTOTYPE: 시안(09-roaming-dog.html)의 강아지 그림과 부위 움직임 코드를 그대로 가져와 dog.html을 만든다.
import re, pathlib
here = pathlib.Path(__file__).parent
src = (here / '../../.scratch/class-bell-app/assets/09-roaming-dog.html').resolve().read_text()
lines = src.split('\n')
dog_div = next(l for l in lines if l.lstrip().startswith('<div id="dog">'))
templates = src[src.index('<template id="t-bucktooth">'):src.rindex('</template>') + len('</template>')]
script = src[src.index('<script>') + 8:src.rindex('</script>')]
rig = script[script.index('const DEFS='):script.index('function hearts()')]
# 시안의 조작판 대신 CFG 값을 쓴다.
rig = re.sub(r"const \$=id=>.*\n", "const $=id=>document.getElementById(id), stage=$('stage'), dog=$('dog'), flip=$('flip'), hop=$('hop'), chute=$('chute');\n", rig)
rig = re.sub(r"THEMES\.forEach\(t=>\$\('theme'\)\.add.*\n", "", rig)
rig = re.sub(r"let x=300.*\n", "", rig)
rig = re.sub(r"const floor=.*\n|const gap=.*\n", "", rig)
rig = rig.replace("$('theme').value", "CFG.theme").replace("+$('size').value", "CFG.size")
left = re.findall(r"\$\('[a-z]+'\)[^,;)]*", rig.split("chute=$('chute');")[1]); print('left', left)
css = '''*{box-sizing:border-box}html,body{height:100%;margin:0;overflow:hidden;background:transparent}
#stage{position:absolute;inset:0;overflow:hidden;user-select:none}
#dog{position:absolute;left:0;top:0;width:0;height:0}
#flip{position:absolute;cursor:grab}#flip.drag{cursor:grabbing}
#hop svg{display:block;overflow:visible}
#chute{position:absolute;pointer-events:none;transform-origin:50% 100%;transform:scale(0);opacity:0;transition:transform .35s ease-out,opacity .2s}
#chute.open{transform:scale(1);opacity:1}
#chute.fold{transform:scale(1,.2);opacity:0;transition:transform .4s ease-in,opacity .4s}
.heart{position:absolute;pointer-events:none;color:#ff5d7d;animation:heart 1s ease-out forwards;opacity:0}
@keyframes heart{0%{opacity:0;transform:translate(0,6px) scale(.4)}20%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--dx),-46px) scale(1.1)}}
body.debug #stage{outline:2px dashed rgba(255,0,0,.6);outline-offset:-2px}'''
driver = (here / 'driver.js').read_text()
out = ('<!doctype html><html lang="ko"><meta charset="utf-8"><title>dog-window-probe</title>\n'
       '<!-- PROTOTYPE (버리는 코드). build-renderer.py가 만든 파일이다. -->\n<style>' + css + '</style>\n'
       '<div id="stage">' + dog_div.strip() + '</div>\n' + templates + '\n<script>\n'
       "const {ipcRenderer}=require('electron');const CFG=JSON.parse(decodeURIComponent(location.hash.slice(1)));\n"
       "let x=0,y=0,dir=1;\n" + rig + '\n' + driver + '\n</script>\n')
(here / 'dog.html').write_text(out)
print('dog.html', len(out))
