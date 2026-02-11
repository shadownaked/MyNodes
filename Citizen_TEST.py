# -*- coding: utf-8 -*-
# [Protocol Check: Strict Maintenance Mode Active - Detail Preservation 100%]
# FileName: Citizen_TEST.py
# Purpose: 公民核验站 - 异步 TCP 探测与增量信用维护系统 [cite: 2026-02-09]

import asyncio
import time
import random
import yaml
import os
import sys

# --- 物理参数对齐 ---
SOURCE_CONFIG = "Candidate_config.yaml"
CITIZEN_FILE = "Citizen_Candidate.yaml"
MAX_CITIZENS = 500
CONCURRENT_LIMIT = 50
FAIL_THRESHOLD = 10  # 连续 10 次失败物理剔除
ROUNDS = 3           # 探测轮次
TIMEOUT = 5          # 握手超时

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
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(server, port), timeout=TIMEOUT
                )
                writer.close()
                await writer.wait_closed()
            return int((time.perf_counter() - start) * 1000)
        except:
            return None

    def load_yaml(self, file_path):
        if not os.path.exists(file_path): return {"proxies": []}
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {"proxies": []}

    async def run(self):
        print(f"🚀 [{self.current_time}] 公民核验起飞...")
        
        # 1. 物理读取：原始矿源 + 现有池子
        raw_data = self.load_yaml(SOURCE_CONFIG)
        old_data = self.load_yaml(CITIZEN_FILE)
        
        # 建立映射方便去重更新: {(server, port): proxy_dict}
        citizen_pool = { (p['server'], p['port']): p for p in old_data.get('proxies', []) }
        
        # 提取所有待测节点（合并 Raw 和 Old）
        all_targets = {}
        for p in raw_data.get('proxies', []):
            all_targets[(p['server'], p['port'])] = p
        for k, v in citizen_pool.items():
            if k not in all_targets: all_targets[k] = v

        results = {} # 暂存本轮成功的结果

        # 2. 三轮撞击逻辑
        for r in range(1, ROUNDS + 1):
            print(f"📡 正在执行第 {r}/{ROUNDS} 轮物理探测...")
            tasks = []
            keys = list(all_targets.keys())
            for k in keys:
                if k not in results: # 只测还没通的
                    tasks.append(self.probe_node(k, all_targets[k]))
            
            round_results = await asyncio.gather(*tasks)
            for res in round_results:
                if res: results[(res['server'], res['port'])] = res

            if r < ROUNDS:
                sleep_time = random.randint(30, 45)
                print(f"💤 轮次间歇，物理休眠 {sleep_time} 秒...")
                await asyncio.sleep(sleep_time)

        # 3. 信用增量合并逻辑
        final_list = []
        for k, target in all_targets.items():
            if k in results:
                # 探测成功：更新/激活
                p = results[k]
                p['fail_count'] = 0
                p['last_seen'] = self.current_time
                p['ping'] = results[k]['ping']
                if k not in citizen_pool: self.new_citizens_count += 1
                final_list.append(p)
            else:
                # 探测失败：继承老公民并加权失败次数
                if k in citizen_pool:
                    p = citizen_pool[k]
                    p['fail_count'] = p.get('fail_count', 0) + 1
                    if p['fail_count'] < FAIL_THRESHOLD:
                        final_list.append(p)
                    else:
                        print(f"💀 节点 {p['name']} 连续 {FAIL_THRESHOLD} 次失联，物理剔除")

        # 4. 排序与截断 (500 条协议)
        # 排序权重：Ping 升序 > 时间戳降序
        final_list.sort(key=lambda x: (x.get('ping', 9999), x.get('last_seen', "")))
        final_list = final_list[:MAX_CITIZENS]

        # 5. 物理落地
        with open(CITIZEN_FILE, 'w', encoding='utf-8') as f:
            yaml.dump({"proxies": final_list}, f, allow_unicode=True, sort_keys=False)

        print(f"📊 本轮结束：新增 {self.new_citizens_count} 个公民，当前池子总数: {len(final_list)}")
        
        # 6. 报警判定
        if self.new_citizens_count == 0:
            print(f"⚠️ [ALARM] 2026-02-11: 本轮增量为 0")
            sys.exit(100) # 特殊状态码表示增量为 0

    async def probe_node(self, key, proxy):
        ping = await self.tcp_ping(proxy['server'], proxy['port'])
        if ping:
            proxy['ping'] = ping
            return proxy
        return None

if __name__ == "__main__":
    asyncio.run(CitizenManager().run())
