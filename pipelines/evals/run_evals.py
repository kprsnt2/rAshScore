import argparse
import json
from datetime import datetime
from google.cloud import bigquery
from config import BQ_FULL_DATASET

from .score_evaluator import evaluate_cross_model
from .drift_detector import detect_drift

def run_evals(run_date: str):
    print(f"Running Evals for date: {run_date}")
    print("=" * 40)
    
    print("\n1. Cross-Model Agreement")
    print("-" * 40)
    cross_model_results = evaluate_cross_model(run_date)
    print(f"Industries evaluated: {cross_model_results['industries_evaluated']}")
    print(f"Average Agreement (Kendall Tau scaled 0-1): {cross_model_results['avg_agreement']:.4f}")
    
    print("\nModel Bias:")
    for model, bias in cross_model_results['model_bias'].items():
        print(f"  {model}: {bias:+.2f}")
        
    high_disagreements = cross_model_results['high_disagreement']
    print(f"\nBrands with high disagreement (>15pt): {len(high_disagreements)}")
    for item in high_disagreements:
        print(f"  - {item['brand']} ({item['industry']}): spread={item['spread']} {item['scores']}")
        
    print("\n2. Temporal Drift Detection")
    print("-" * 40)
    drift_results = detect_drift(run_date)
    print(f"Overall drift: {drift_results['overall_drift']:+.2f} points")
    
    drifted_inds = drift_results['drifted_industries']
    print(f"\nDrifted industries (>5pt): {len(drifted_inds)}")
    for item in drifted_inds:
        print(f"  - {item['name']}: {item['delta']:+.2f} (Today: {item['avg_today']:.1f}, 7d: {item['avg_7d']:.1f})")
        
    drifted_brands = drift_results['drifted_brands']
    print(f"\nDrifted brands (>10pt): {len(drifted_brands)}")
    for item in drifted_brands:
        print(f"  - {item['brand']} ({item['industry']}): {item['delta']:+.2f} (Today: {item['score_today']}, 7d: {item['avg_7d']:.1f})")
        
    try:
        client = bigquery.Client()
        table_id = f"{BQ_FULL_DATASET}.eval_results"
        
        schema = [
            bigquery.SchemaField("run_date", "DATE", mode="REQUIRED"),
            bigquery.SchemaField("overall_drift", "FLOAT64"),
            bigquery.SchemaField("avg_agreement", "FLOAT64"),
            bigquery.SchemaField("high_disagreement_count", "INT64"),
            bigquery.SchemaField("drifted_brands_count", "INT64"),
            bigquery.SchemaField("drifted_industries_count", "INT64"),
            bigquery.SchemaField("details_json", "STRING"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE", default_value_expression="CURRENT_TIMESTAMP()"),
        ]
        
        table = bigquery.Table(table_id, schema=schema)
        table.time_partitioning = bigquery.TimePartitioning(
            type_=bigquery.TimePartitioningType.DAY,
            field="run_date",
        )
        client.create_table(table, exists_ok=True)
        
        details = {
            "cross_model": cross_model_results,
            "drift": drift_results
        }
        
        rows_to_insert = [
            {
                "run_date": run_date,
                "overall_drift": float(drift_results['overall_drift']),
                "avg_agreement": float(cross_model_results['avg_agreement']),
                "high_disagreement_count": len(high_disagreements),
                "drifted_brands_count": len(drifted_brands),
                "drifted_industries_count": len(drifted_inds),
                "details_json": json.dumps(details)
            }
        ]
        
        errors = client.insert_rows_json(table_id, rows_to_insert)
        if not errors:
            print(f"\n✅ Successfully wrote eval results to {table_id}")
        else:
            print(f"\n⚠ Errors writing to BigQuery: {errors}")
            
    except Exception as e:
        print(f"\n⚠ Failed to write to BigQuery: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run AI evals for rAsh Score.")
    parser.add_argument("--date", type=str, default=datetime.today().strftime("%Y-%m-%d"),
                        help="Date to run evals for (YYYY-MM-DD)")
    args = parser.parse_args()
    
    run_evals(args.date)
