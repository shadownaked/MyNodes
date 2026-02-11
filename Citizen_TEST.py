# -*- coding: utf-8 -*-
# [Protocol Check: Strict Maintenance Mode Active - Detail Preservation 100%]
# FileName: Citizen_TEST.py
# Version: 2.3.0 (Full Logic Integrity)

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
        try:
            async with self.semaphore:
                start = time.perf_counter()
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(server, int(port)), timeout=TIMEOUT
                )
                writer.close()
                await writer.wait_closed()
                return int((time.perf_counter() - start) * 1000)
        except:
            return None

    def robust_load(self, file_path):
        """全量节点读取，具备 YAML 容错能力"""
        if not os.path.exists(file_path): return []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                if data and isinstance(data.get('proxies'), list):
                    return data['proxies']
        except:
            # 暴力流式提取完整字典块
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
        print(f"🚀 [{self.current_time}] 终极核验开始...")
        
        # 1. 加载现有数据
        raw_nodes = self.robust_load(SOURCE_CONFIG)
        old_nodes = self.robust_load(CITIZEN_FILE)
        
        # 建立索引映射 (server, port) -> node_dict
        old_pool = { (str(p.get('server')), int(p.get('port', 0))): p for p in old_nodes }
        
        # 汇总所有待测目标 (优先保留老公民的状态)
        all_targets = {}
        for p in raw_nodes:
            key = (str(p.get('server')), int(p.get('port', 0)))
            all_targets[key] = p
        for key, p in old_pool.items():
            all_targets[key] = p # 老公民覆盖新发现，保留 fail_count 等

        results = {}
        # 2. 三轮物理探测逻辑 (跨度约 1 分钟)
        for r in range(1, ROUNDS + 1):
            print(f"📡 探测轮次 {r}/{ROUNDS}...")
            tasks = []
            # 找出本轮需要探测的 (还没通的)
            test_keys = [k for k in all_targets.keys() if k not in results]
            for k in test_keys:
                tasks.append(self.probe_task(k, all_targets[k]))
            
            round_res = await asyncio.gather(*tasks)
            for res in round_res:
                if res: results[res['key']] = res['ping']

            if r < ROUNDS:
                wait = random.randint(30, 40)
                print(f"💤 随机休眠 {wait}s...")
                await asyncio.sleep(wait)

        # 3. 准入与优胜劣汰
        final_pool = []
        for key, node in all_targets.items():
            if key in results:
                # 探测成功：赋予/更新公民身份
                node['ping'] = results[key]
                node['fail_count'] = 0
                node['last_seen'] = self.current_time
                if key not in old_pool: self.new_citizens_count += 1
                final_pool.append(node)
            else:
                # 探测失败：如果是“老兵”，允许抢救；如果是“新兵”，直接物理消失
                if key in old_pool:
                    p = old_pool[key]
                    p['fail_count'] = p.get('fail_count', 0) + 1
                    if p['fail_count'] < FAIL_THRESHOLD:
                        p['ping'] = 9999 # 没通的排在最后
                        final_pool.append(p)
                    else:
                        print(f"💀 老兵连续 {FAIL_THRESHOLD} 次失联，物理执行死刑: {p.get('name')}")

        # 4. 排序与物理编号 (核心排名逻辑)
        # 按 Ping 升序，Ping 相同按最后看到时间降序
        final_pool.sort(key=lambda x: (x.get('ping', 9999), x.get('last_seen', "")))
        
        # 只取前 500 名
        final_pool = final_pool[:MAX_CITIZENS]

        # 物理注入编号：Citizen_001_45ms
        for i, node in enumerate(final_pool, 1):
            latency = f"{node['ping']}ms" if node['ping'] != 9999 else "Timeout"
            node['name'] = f"Citizen_{i:03d}_{latency}"

        # 5. 归仓：强制单行横排格式 (Flow Style)
        with open(CITIZEN_FILE, 'w', encoding='utf-8') as f:
            # 使用 default_flow_style=True 强制单行，让一个节点只占一行
            yaml.dump({"proxies": final_pool}, f, allow_unicode=True, sort_keys=False, default_flow_style=True)

        print(f"📊 任务总结：")
        print(f"   - 发现新公民: {self.new_citizens_count}")
        print(f"   - 池子总容量: {len(final_pool)} / {MAX_CITIZENS}")
        
        if self.new_citizens_count == 0:
            sys.exit(100)

    async def probe_task(self, key, node):
        p = await self.tcp_ping(key[0], key[1])
        if p: return {'key': key, 'ping': p}
        return None

if __name__ == "__main__":
    asyncio.run(CitizenManager().run())
