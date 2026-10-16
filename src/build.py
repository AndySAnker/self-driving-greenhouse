"""Build the game from src/ into the website files.

    python3 src/build.py            -> writes index.html (GitHub Pages version, live class board)
    python3 src/build.py --offline  -> also writes dist/offline.html (single file, three.js from CDN, no live board)

Edit the files in src/ (head.html and js/*.js), never index.html directly.
"""
import glob, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CLASS = os.environ.get("SDL_CLASS", "aalto-bf9c94")   # class name for the live leaderboard (ntfy.sh topic suffix)
CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'

head = open(os.path.join(HERE, "head.html")).read()
js = "\n".join(open(f).read() for f in sorted(glob.glob(os.path.join(HERE, "js", "*.js"))))
page = head.replace("/*__GAME_JS__*/", js)

top, rest = page.split("<style>", 1)
css, body = rest.split("</style>", 1)
doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       + top + "<style>" + css + "</style>\n</head>\n<body>\n" + body + "\n</body>\n</html>\n")
assert CDN in doc, "three.js script tag not found in head.html"

site = doc.replace(CDN, '<script src="three.min.js"></script>\n<script>\n'
                   '  /* Class name for the live leaderboard. Change it for each class, or add ?class=othername to the link. */\n'
                   '  window.SDL_CLASS = "' + CLASS + '";\n</script>')
open(os.path.join(ROOT, "index.html"), "w").write(site)
print("wrote index.html (class:", CLASS + ")")

if "--offline" in sys.argv:
    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    open(os.path.join(ROOT, "dist", "offline.html"), "w").write(doc)
    print("wrote dist/offline.html")
