# -*- coding: utf-8 -*-
# [Protocol Check: Strict Maintenance Mode Active - Detail Preservation 100%]
# FileName: Citizen_TEST.py
# Version: 3.0.0 (Veteran Class & Flow Control)

import asyncio
import time
import random
import yaml
import os
import sys
import re
from collections import OrderedDict

# --- 物理参数锁定 ---
SOURCE_CONFIG = "Candidate_config.yaml"
CITIZEN_FILE = "Citizen_Candidate.yaml"
MAX_CITIZENS = 500
CONCURRENT_LIMIT = 50
FAIL_THRESHOLD = 10 
ROUNDS = 3           
PING_CEILING = 5000  # 爸爸定的活人保底线
TIMEOUT = 6          # 略微放宽超时以匹配保底线

class CitizenManager:
    def __init__(self):
        self.semaphore = asyncio.Semaphore(CONCURRENT_LIMIT)
        self.current_time = time.strftime("%Y-%m-%d %H:%M")
        self.stats = {"new": 0, "class1": 0, "class2": 0, "class3": 0, "class0": 0}

    async def tcp_ping(self, server, port):
        """物理 TCP 握手探测"""
        try:
            async with self.semaphore:
                start = time.perf_counter()
                _, writer = await asyncio.wait_for(
                    asyncio.open_connection(server, int(port)), timeout=TIMEOUT
                )
                writer.close()
                await writer.wait_closed()
                ms = int((time.perf_counter() - start) * 1000)
                return ms if ms <= PING_CEILING else None
        except:
            return None

    def robust_load(self, file_path):
        """增强版全量读取：支持 YAML 容错与字典保持"""
        if not os.path.exists(file_path): return []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                if data and isinstance(data.get('proxies'), list):
                    return data['proxies']
        except:
            proxies = []
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    blocks = re.findall(r'-\s*(\{.*?\})', content, re.DOTALL)
                    for b_str in blocks:
                        try:
                            fixed_b = re.sub(r'(\w+):\s*([^,"\'\}\s]+)', r'\1: "\2"', b_str)
                            node = yaml.safe_load(fixed_b)
                            if node and 'server' in node: proxies.append(node)
                        except: continue
            except: pass
            return proxies
        return []

    async def run(self):
        print(f"🚀 [{self.current_time}] 公民等级核验起飞...")
        
        raw_nodes = self.robust_load(SOURCE_CONFIG)
        old_nodes = self.robust_load(CITIZEN_FILE)
        
        old_pool = { (str(p.get('server')), int(p.get('port', 0))): p for p in old_nodes }
        all_targets = {}
        for p in raw_nodes:
            key = (str(p.get('server')), int(p.get('port', 0)))
            all_targets[key] = p
        for key, p in old_pool.items():
            all_targets[key] = p

        probe_results = {key: [] for key in all_targets.keys()}

        # 3轮阶级撞击
        for r in range(1, ROUNDS + 1):
            print(f"📡 阶级撞击轮次 {r}/{ROUNDS}...")
            tasks = []
            for key in all_targets.keys():
                tasks.append(self.probe_task(key, all_targets[key]))
            
            round_data = await asyncio.gather(*tasks)
            for item in round_data:
                if item and item['ping'] is not None:
                    probe_results[item['key']].append(item['ping'])

            if r < ROUNDS:
                wait = random.randint(30, 40)
                print(f"💤 物理休眠 {wait}s...")
                await asyncio.sleep(wait)

        # 等级评定与属性封装
        final_list = []
        for key, node in all_targets.items():
            pings = probe_results[key]
            success_count = len(pings)
            
            # 物理阶级定义
            if success_count > 0:
                avg_ping = int(sum(pings) / success_count)
                node['ping'] = avg_ping
                node['class'] = f"class{4-success_count}" # 3次通为class1
                node['fail_count'] = 0
                node['last_seen'] = self.current_time
                if key not in old_pool: self.stats["new"] += 1
                self.stats[f"class{4-success_count}"] += 1
                final_list.append(node)
            elif key in old_pool:
                # 老兵抢救逻辑 (Class 0)
                node['fail_count'] = node.get('fail_count', 0) + 1
                if node['fail_count'] < FAIL_THRESHOLD:
                    node['ping'] = 9999
                    node['class'] = "class0"
                    self.stats["class0"] += 1
                    final_list.append(node)

        # 排序：等级(class1>2>3>0) -> Ping(升序)
        final_list.sort(key=lambda x: (x.get('class', 'class9'), x.get('ping', 9999)))
        final_list = final_list[:MAX_CITIZENS]

        # 物理重命名与字段重组 (保证 name 在行首)
        ordered_final = []
        for i, p in enumerate(final_list, 1):
            latency = f"{p['ping']}ms" if p['ping'] < 9999 else "Timeout"
            cls = p.get('class', 'class0')
            new_name = f"Citizen_{i:03d}_{latency}_{cls}"
            
            # 强制 OrderedDict 保证 name 置顶
            d = OrderedDict()
            d['name'] = new_name
            for k, v in p.items():
                if k not in ['name', 'class', 'ping', 'fail_count', 'last_seen']:
                    d[k] = v
            # 附加元数据以便后续追踪
            d['ping'] = p['ping']
            d['class'] = cls
            d['fail_count'] = p.get('fail_count', 0)
            d['last_seen'] = p.get('last_seen', self.current_time)
            ordered_final.append(d)

        # 物理归仓：强制单行无限宽度
        with open(CITIZEN_FILE, 'w', encoding='utf-8') as f:
            header = f"# [Update: {self.current_time}] | Total: {len(ordered_final)} | New: {self.stats['new']} | C1: {self.stats['class1']} | C2: {self.stats['class2']} | C3: {self.stats['class3']} | C0: {self.stats['class0']}\n"
            f.write(header)
            # 关键：width=float('inf') 杜绝长密码换行
            yaml.dump({"proxies": ordered_final}, f, allow_unicode=True, sort_keys=False, default_flow_style=True, width=float('inf'))

        print(f"📊 任务完成：{header}")
        if self.stats["new"] == 0: sys.exit(100)

    async def probe_task(self, key, node):
        p = await self.tcp_ping(key[0], key[1])
        return {'key': key, 'ping': p}

if __name__ == "__main__":
    # 强制让 yaml 支持 OrderedDict
    yaml.add_representer(OrderedDict, lambda dumper, data: dumper.represent_mapping('tag:yaml.org,2002:map', data.items()))
    asyncio.run(CitizenManager().run())
