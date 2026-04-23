import os
import yaml
import asyncio
import edge_tts

# Konfigurasi Teks ke Suara
VOICE = "id-ID-ArdiNeural"
DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(DOCS_DIR, "tools")
AUDIO_DIR = os.path.join(DOCS_DIR, "audio")

if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

async def generate_tool_audio():
    print(f"Mulai men-generate audio Menggunakan Edge-TTS ({VOICE})...")
    print(f"Directory data: {TOOLS_DIR}")
    print(f"Directory output: {AUDIO_DIR}\n")
    
    for filename in sorted(os.listdir(TOOLS_DIR)):
        if not filename.endswith(".yaml"):
            continue
            
        filepath = os.path.join(TOOLS_DIR, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                data = yaml.safe_load(f)
            except Exception as e:
                print(f"Gagal memparsing {filename}: {e}")
                continue
                
        tools = data.get("tools", [])
        if not tools:
            continue
            
        print(f"► Memproses {filename} ({len(tools)} tools)")
        
        for index, tool in enumerate(tools):
            name = tool.get("name", "")
            category = tool.get("category", "")
            desc = tool.get("description", "")
            spec = tool.get("specific_function", "")
            retro_role = ""
            
            if isinstance(tool.get("retro"), dict):
                retro_role = tool["retro"].get("role", "")
            
            # Membentuk teks narasi yg akan dibaca
            # Eksplisit Mengecualikan setup & usage
            text_parts = [
                f"Alat ini bernama {name}. Termasuk dalam kategori {category}. "
            ]
            
            if desc:
                text_parts.append(f"Fungsi utama dari alat ini adalah: {desc.strip()} ")
                
            if spec:
                text_parts.append(f"Fungsi spesifiknya: {spec.strip()} ")
                
            if retro_role:
                text_parts.append(f"Dalam arsitektur RETRO, perannya yaitu: {retro_role.strip()} ")
                
            text_parts.append("Untuk setup dan sintaks kodenya, seperti yang tertera di layar Anda.")
            
            # Gabungkan dan bersihkan multiple whitespace
            full_text = " ".join(text_parts)
            full_text = " ".join(full_text.split())
            
            base_filename = filename.replace(".yaml", "")
            output_file = os.path.join(AUDIO_DIR, f"{base_filename}_{index}.mp3")
            
            print(f"  [GENERATE] {base_filename}_{index}.mp3 (Rate +15%, Pitch -20Hz) ...", end=" ", flush=True)
            
            try:
                communicate = edge_tts.Communicate(full_text, VOICE, rate="+15%", volume="+0%", pitch="-20Hz")
                await communicate.save(output_file)
                print("OK")
            except Exception as e:
                print(f"ERROR: {e}")
                
if __name__ == "__main__":
    asyncio.run(generate_tool_audio())
    print("\nProses generate selesai!")
