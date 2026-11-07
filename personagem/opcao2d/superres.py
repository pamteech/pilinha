# Amplia a folha de arte 4x com Real-ESRGAN (modelo anime, ncnn na CPU) antes de gerar as folhas de animação.
# Modelos: realesrgan-x4plus-anime.param/.bin do zip realesrgan-ncnn-vulkan (github.com/xinntao/Real-ESRGAN/releases).
# Uso: pip install ncnn && python3 personagem/opcao2d/superres.py <pasta_dos_modelos>   -> grava folha_hi.jpg (3456x4608)
import sys, os, time, numpy as np, ncnn
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); models = sys.argv[1]
net = ncnn.Net(); net.opt.use_vulkan_compute = False; net.opt.num_threads = os.cpu_count() or 4
net.load_param(os.path.join(models, 'realesrgan-x4plus-anime.param')); net.load_model(os.path.join(models, 'realesrgan-x4plus-anime.bin'))
def x4(im):
    m = ncnn.Mat.from_pixels(im.tobytes(), ncnn.Mat.PixelType.PIXEL_RGB, im.width, im.height); m.substract_mean_normalize([0, 0, 0], [1 / 255.0] * 3)
    ex = net.create_extractor(); ex.input('data', m); _, o = ex.extract('output')
    return Image.fromarray((np.clip(np.array(o), 0, 1) * 255).round().astype(np.uint8).transpose(1, 2, 0), 'RGB')
src = Image.open(os.path.join(HERE, 'folha_ia.jpg')).convert('RGB'); W, H = src.size; cw, ch = W // 3, H // 3
out = Image.new('RGB', (cw * 12, ch * 12)); t = time.time()
for r in range(3):
    for c in range(3):
        out.paste(x4(src.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))), (c * cw * 4, r * ch * 4)); print('célula', r, c, round(time.time() - t), 's')
out.save(os.path.join(HERE, 'folha_hi.jpg'), quality=92); print('folha_hi.jpg', out.size)
