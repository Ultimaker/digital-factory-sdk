#
# This script demonstrates how to create and retrieve a report from the Ultimaker API with the help of an API token.
#
import json
from datetime import datetime, timedelta, timezone
from time import sleep
from typing import Optional, Tuple
from urllib import request

API_TOKEN = "<<API token here>>"
DF_API = "https://api.ultimaker.com/"

report_url = DF_API + "report/v1/reports"

def get_all_clusters() -> list:
    req = request.Request(
        DF_API + "connect/v1/cluster",
        method="GET",
        headers={"Authorization": "Bearer " + API_TOKEN},
    )
    with request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))["data"]

def put_report(cluster_ids: list[str]) -> tuple[int, str]:
    start_date = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    end_date = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    report_data = {
        "data": {
            "cluster_ids": cluster_ids,
            "end_date": end_date,
            "generated_time": None,
            "report_type": "print_jobs",
            "start_date": start_date
        }
    }

    req = request.Request(
        report_url,
        data=json.dumps(report_data).encode("utf-8"),
        method="PUT",
        headers={
            "Authorization": "Bearer " + API_TOKEN,
            "Content-Type": "application/json",
        },
    )
    with request.urlopen(req) as response:
        return response.getcode(), response.read().decode("utf-8")

def get_report_status(report_id: str) -> Tuple[bool, Optional[str]]:
    req = request.Request(
        report_url + "/" + report_id,
        method="GET",
        headers={"Authorization": "Bearer " + API_TOKEN},
    )
    with request.urlopen(req) as response:
        report_info = json.loads(response.read().decode("utf-8"))
        if report_info["data"]["status"] == "success":
            return True, report_info["data"]["download_url"]
        return False, None

def get_report(cluster_ids: list[str]) -> Optional[str]:
    code, content = put_report(cluster_ids)
    if code != 201:
        print(f"Failed to create report: {code} {content}")
        return None
    report_info = json.loads(content)

    report_id = report_info["data"]["report_id"]
    print(f"Report created with ID: {report_id}")

    done, download_url = get_report_status(report_id)
    retry_count = 0
    while not done and retry_count < 30:
        print("Report is still being generated...")
        done, download_url = get_report_status(report_id)
        sleep(2)
        retry_count += 1
    return download_url

def main():
    cluster_ids = [item["cluster_id"] for item in get_all_clusters()]
    print(f"Creating report for {len(cluster_ids)} clusters.")
    download_url = get_report(cluster_ids)
    print(f"Report is ready! Download URL: {download_url}")

main()
