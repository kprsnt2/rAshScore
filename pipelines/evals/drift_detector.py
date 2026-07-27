from google.cloud import bigquery
from config import BQ_FULL_DATASET

def detect_drift(run_date: str, lookback_days: int = 7) -> dict:
    client = bigquery.Client()
    
    query = f"""
        WITH historical AS (
            SELECT 
                industry_id, 
                brand, 
                AVG(score) as avg_score
            FROM `{BQ_FULL_DATASET}.brand_scores`
            WHERE run_date >= DATE_SUB(@run_date, INTERVAL @lookback_days DAY)
              AND run_date < @run_date
              AND score IS NOT NULL
            GROUP BY industry_id, brand
        ),
        today AS (
            SELECT 
                industry_id, 
                brand, 
                AVG(score) as score_today
            FROM `{BQ_FULL_DATASET}.brand_scores`
            WHERE run_date = @run_date
              AND score IS NOT NULL
            GROUP BY industry_id, brand
        )
        SELECT 
            COALESCE(t.industry_id, h.industry_id) AS industry_id,
            COALESCE(t.brand, h.brand) AS brand,
            t.score_today,
            h.avg_score AS avg_7d
        FROM today t
        FULL OUTER JOIN historical h 
            ON t.industry_id = h.industry_id AND t.brand = h.brand
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("run_date", "DATE", run_date),
            bigquery.ScalarQueryParameter("lookback_days", "INT64", lookback_days)
        ]
    )
    
    results = client.query(query, job_config=job_config).result()
    
    industry_stats = {}
    drifted_brands = []
    
    overall_today_sum = 0.0
    overall_today_count = 0
    overall_7d_sum = 0.0
    overall_7d_count = 0
    
    for row in results:
        ind = row.industry_id
        brand = row.brand
        score_today = row.score_today
        avg_7d = row.avg_7d
        
        if ind not in industry_stats:
            industry_stats[ind] = {'today_sum': 0.0, 'today_count': 0, '7d_sum': 0.0, '7d_count': 0}
            
        if score_today is not None:
            industry_stats[ind]['today_sum'] += score_today
            industry_stats[ind]['today_count'] += 1
            overall_today_sum += score_today
            overall_today_count += 1
            
        if avg_7d is not None:
            industry_stats[ind]['7d_sum'] += avg_7d
            industry_stats[ind]['7d_count'] += 1
            overall_7d_sum += avg_7d
            overall_7d_count += 1
            
        if score_today is not None and avg_7d is not None:
            delta = score_today - avg_7d
            if abs(delta) > 10:
                drifted_brands.append({
                    'brand': brand,
                    'industry': ind,
                    'score_today': int(round(score_today)),
                    'avg_7d': avg_7d,
                    'delta': delta
                })
                
    drifted_industries = []
    for ind, stats in industry_stats.items():
        if stats['today_count'] > 0 and stats['7d_count'] > 0:
            avg_today = stats['today_sum'] / stats['today_count']
            avg_7d_ind = stats['7d_sum'] / stats['7d_count']
            delta = avg_today - avg_7d_ind
            if abs(delta) > 5:
                drifted_industries.append({
                    'id': ind,
                    'name': ind,
                    'avg_today': avg_today,
                    'avg_7d': avg_7d_ind,
                    'delta': delta
                })
                
    overall_drift = 0.0
    if overall_today_count > 0 and overall_7d_count > 0:
        overall_today = overall_today_sum / overall_today_count
        overall_7d_avg = overall_7d_sum / overall_7d_count
        overall_drift = overall_today - overall_7d_avg
        
    return {
        'date': run_date,
        'drifted_industries': drifted_industries,
        'drifted_brands': drifted_brands,
        'overall_drift': overall_drift
    }
