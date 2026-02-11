# -*- coding: utf-8 -*-
# [Protocol Check: Strict Maintenance Mode Active - Detail Preservation 100%]
# FileName: Citizen_TEST.py
# Version: 2.2.0 (Full Node Integrity Preservation)
# Purpose: 具备全字段保留能力的暴力防爆核验系统 [cite: 2026-02-09]

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
        """物理 TCP 探测"""
        start = time.perf_counter()
        try:
            async with self.semaphore:
                _, writer = await asyncio.wait_for(
                    asyncio.open_connection(server, int(port)), timeout=TIMEOUT
                )
                writer.close()
                await writer.wait_closed()
            return int((time.perf_counter() - start) * 1000)
        except:
            return None

    def robust_load(self, file_path):
        """鲁棒性读取：全量提取节点字典 [cite: 2026-01-31]"""
        if not os.path.exists(file_path): return []
        
        # 尝试标准加载
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                if data and isinstance(data.get('proxies'), list):
                    return data['proxies']
        except Exception as e:
            print(f"⚠️ YAML 标准解析失败，切换流式物理修复模式: {e}")

        # 兜底：逐行物理清洗并暴力提取完整字典
        proxies = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                # 寻找每一个以 - { 开始，以 } 结束的物理块
                blocks = re.findall(r'-\s*(\{.*?\})', content, re.DOTALL)
                for b_str in blocks:
                    try:
                        # 物理修复：强制补齐缺失引号，确保基本解析
                        fixed_b = re.sub(r'(\w+):\s*([^,"\'\}\s]+)', r'\1: "\2"', b_str)
                        node = yaml.safe_load(fixed_b)
                        if node and 'server' in node: proxies.append(node)
                    except: continue
        except: pass
        return proxies

    async def run(self):
        print(f"🚀 [{self.current_time}] 全量核验起飞...")
        
        # 1. 物理读取完整节点信息
        raw_proxies = self.robust_load(SOURCE_CONFIG)
        old_proxies = self.robust_load(CITIZEN_FILE)
        
        # 2. 建立池子 (保留全量属性)
        pool = {}
        for p in raw_proxies:
            key = (str(p.get('server')), int(p.get('port', 0)))
            pool[key] = p
        for p in old_proxies:
            key = (str(p.get('server')), int(p.get('port', 0)))
            if key not in pool: pool[key] = p

        results = {}
        # 3. 三轮探测逻辑 (保持 30s+ 随机)
        for r in range(1, ROUNDS + 1):
            print(f"📡 轮次 {r}/{ROUNDS} (并发控制: {CONCURRENT_LIMIT})")
            tasks = []
            keys = [k for k in pool.keys() if k not in results]
            for k in keys:
                tasks.append(self.probe_node(k, pool[k]))
            
            round_res = await asyncio.gather(*tasks)
            for res in round_res:
                if res: results[(str(res['server']), int(res['port']))] = res

            if r < ROUNDS:
                wait = random.randint(30, 50)
                print(f"💤 物理休眠 {wait}s...")
                await asyncio.sleep(wait)

        # 4. 优胜劣汰与属性平移
        final_list = []
        for k, p in pool.items():
            if k in results:
                # 探测成功：全量属性平移并更新
                p.update(results[k])
                p['fail_count'] = 0
                p['last_seen'] = self.current_time
                if k not in {(str(x.get('server')), int(x.get('port', 0))) for x in old_proxies}:
                    self.new_citizens_count += 1
                final_list.append(p)
            else:
                # 探测失败：如果是老公民，增加失败计数
                p['fail_count'] = p.get('fail_count', 0) + 1
                if p['fail_count'] < FAIL_THRESHOLD:
                    final_list.append(p)

        # 5. 排序与截断
        final_list.sort(key=lambda x: (x.get('ping', 9999), x.get('last_seen', "")))
        final_list = final_list[:MAX_CITIZENS]

        # 6. 物理归仓
        with open(CITIZEN_FILE, 'w', encoding='utf-8') as f:
            yaml.dump({"proxies": final_list}, f, allow_unicode=True, sort_keys=False)

        print(f"📊 任务完成：新增 {self.new_citizens_count}，当前池子活跃总数 {len(final_list)}")
        if self.new_citizens_count == 0: sys.exit(100)

    async def probe_node(self, key, proxy):
        ping = await self.tcp_ping(proxy['server'], proxy['port'])
        if ping:
            # 仅返回带 ping 的精简信息用于合并，不破坏原 proxy 字典
            return {'server': proxy['server'], 'port': proxy['port'], 'ping': ping}
        return None

if __name__ == "__main__":
    asyncio.run(CitizenManager().run())
