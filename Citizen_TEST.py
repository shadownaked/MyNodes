# -*- coding: utf-8 -*-
# [Protocol Check: Strict Maintenance Mode Active - Detail Preservation 100%]
# FileName: Citizen_TEST.py
# Version: 2.1.0 (Violence Regex Recovery Mode)
# Purpose: 具备物理防爆能力的公民核验系统 [cite: 2026-02-09]

import asyncio
import time
import random
import yaml
import os
import sys
import re

# --- 物理参数锁定 ---
SOURCE_CONFIG = "Candidate_config.yaml"
CITIZEN_FILE = "Citizen_Candidate.yaml"
MAX_CITIZENS = 500
CONCURRENT_LIMIT = 50
FAIL_THRESHOLD = 10 
ROUNDS = 3           
TIMEOUT = 5          

class CitizenManager:
    def __init__(self):
        self.semaphore = asyncio.Semaphore(CONCURRENT_LIMIT)
        self.current_time = time.strftime("%Y-%m-%d %H:%M")
        self.new_citizens_count = 0

    async def tcp_ping(self, server, port):
        """物理 TCP 握手探测"""
        start = time.perf_counter()
        try:
            async with self.semaphore:
                # 显式转换 port 为 int，防止正则提取出字符串导致崩溃
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(server, int(port)), timeout=TIMEOUT
                )
                writer.close()
                await writer.wait_closed()
            return int((time.perf_counter() - start) * 1000)
        except:
            return None

    def violent_extract(self, file_path):
        """流氓模式：正则暴力提取所有节点字段"""
        proxies = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                # 匹配 server, port, name 的暴力正则
                # 逻辑：寻找包含 server: xxx, port: xxx 的行
                blocks = re.findall(r'-\s*\{(?:[^{}]*)\}', content)
                for block in blocks:
                    try:
                        s = re.search(r'server:\s*([^,}]+)', block)
                        p = re.search(r'port:\s*(\d+)', block)
                        n = re.search(r'name:\s*([^,}]+)', block)
                        if s and p:
                            proxies.append({
                                'server': s.group(1).strip().strip('"').strip("'"),
                                'port': int(p.group(1)),
                                'name': n.group(1).strip().strip('"').strip("'") if n else "Unknown",
                                'type': 'ss' # 默认为粗筛基础类型
                            })
                    except: continue
        except Exception as e:
            print(f"❌ 物理读取失败: {e}")
        return proxies

    def load_smart(self, file_path):
        """智能读取：优先 YAML，失败则暴力正则"""
        if not os.path.exists(file_path): return {"proxies": []}
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                if data and "proxies" in data: return data
        except Exception as e:
            print(f"⚠️ YAML 解析崩溃，启动暴力提取模式... 原因: {e}")
        
        # 启动流氓模式
        proxies = self.violent_extract(file_path)
        return {"proxies": proxies}

    async def run(self):
        print(f"🚀 [{self.current_time}] 暴力版公民核验起飞...")
        
        raw_data = self.load_smart(SOURCE_CONFIG)
        old_data = self.load_smart(CITIZEN_FILE)
        
        citizen_pool = { (str(p['server']), int(p['port'])): p for p in old_data.get('proxies', []) }
        all_targets = {}
        for p in raw_data.get('proxies', []):
            all_targets[(str(p['server']), int(p['port']))] = p
        for k, v in citizen_pool.items():
            if k not in all_targets: all_targets[k] = v

        results = {}
        for r in range(1, ROUNDS + 1):
            print(f"📡 第 {r}/{ROUNDS} 轮探测 (并发: {CONCURRENT_LIMIT})...")
            tasks = []
            for k in all_targets.keys():
                if k not in results:
                    tasks.append(self.probe_node(k, all_targets[k]))
            
            round_res = await asyncio.gather(*tasks)
            for res in round_res:
                if res: results[(str(res['server']), int(res['port']))] = res

            if r < ROUNDS:
                wait = random.randint(30, 45)
                print(f"💤 随机休眠 {wait}s...")
                await asyncio.sleep(wait)

        final_list = []
        for k, target in all_targets.items():
            if k in results:
                p = results[k]
                p['fail_count'] = 0
                p['last_seen'] = self.current_time
                p['ping'] = results[k]['ping']
                if k not in citizen_pool: self.new_citizens_count += 1
                final_list.append(p)
            elif k in citizen_pool:
                p = citizen_pool[k]
                p['fail_count'] = p.get('fail_count', 0) + 1
                if p['fail_count'] < FAIL_THRESHOLD: final_list.append(p)

        final_list.sort(key=lambda x: (x.get('ping', 9999), x.get('last_seen', "")))
        final_list = final_list[:MAX_CITIZENS]

        with open(CITIZEN_FILE, 'w', encoding='utf-8') as f:
            yaml.dump({"proxies": final_list}, f, allow_unicode=True, sort_keys=False)

        print(f"📊 结束：新增 {self.new_citizens_count}, 总数 {len(final_list)}")
        if self.new_citizens_count == 0: sys.exit(100)

    async def probe_node(self, key, proxy):
        ping = await self.tcp_ping(proxy['server'], proxy['port'])
        if ping:
            proxy['ping'] = ping
            return proxy
        return None

if __name__ == "__main__":
    asyncio.run(CitizenManager().run())
