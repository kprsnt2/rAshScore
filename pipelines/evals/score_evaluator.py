import itertools
from google.cloud import bigquery
from config import BQ_FULL_DATASET

def calculate_kendall_tau(list1, list2):
    """Calculate Kendall's tau-b rank correlation coefficient manually."""
    if len(list1) != len(list2) or len(list1) < 2:
        return 0.0
    
    n = len(list1)
    concordant = 0
    discordant = 0
    ties_x = 0
    ties_y = 0
    
    for i in range(n - 1):
        for j in range(i + 1, n):
            x_diff = list1[i] - list1[j]
            y_diff = list2[i] - list2[j]
            
            if x_diff == 0 and y_diff == 0:
                continue
            elif x_diff == 0:
                ties_x += 1
            elif y_diff == 0:
                ties_y += 1
            elif (x_diff * y_diff) > 0:
                concordant += 1
            else:
                discordant += 1
                
    numerator = concordant - discordant
    denominator_x = (n * (n - 1) / 2) - ties_x
    denominator_y = (n * (n - 1) / 2) - ties_y
    
    if denominator_x <= 0 or denominator_y <= 0:
        return 0.0
        
    return numerator / ((denominator_x * denominator_y) ** 0.5)

def evaluate_cross_model(run_date: str) -> dict:
    client = bigquery.Client()
    
    query = f"""
        SELECT 
            industry_id, brand, model, score
        FROM `{BQ_FULL_DATASET}.brand_scores`
        WHERE run_date = @run_date AND score IS NOT NULL
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("run_date", "DATE", run_date)
        ]
    )
    
    query_job = client.query(query, job_config=job_config)
    results = query_job.result()
    
    data_by_industry = {}
    brand_scores = {}
    
    for row in results:
        ind = row.industry_id
        brand = row.brand
        model = row.model
        score = row.score
        
        if ind not in data_by_industry:
            data_by_industry[ind] = {}
        if brand not in data_by_industry[ind]:
            data_by_industry[ind][brand] = {}
            
        data_by_industry[ind][brand][model] = score
        
        if brand not in brand_scores:
            brand_scores[brand] = {'industry': ind, 'scores': {}}
        brand_scores[brand]['scores'][model] = score
        
    high_disagreement = []
    all_models = set()
    
    for b_data in brand_scores.values():
        for m in b_data['scores'].keys():
            all_models.add(m)
            
    avg_agreements = []
    
    for ind, brands_dict in data_by_industry.items():
        ind_models = set()
        for b, m_scores in brands_dict.items():
            ind_models.update(m_scores.keys())
        
        ind_models = list(ind_models)
        if len(ind_models) < 2:
            continue
            
        common_brands = [b for b, m_scores in brands_dict.items() if len(m_scores) >= 2]
        if not common_brands:
            continue
            
        model_pairs = list(itertools.combinations(ind_models, 2))
        for m1, m2 in model_pairs:
            scores_m1 = []
            scores_m2 = []
            for b in common_brands:
                if m1 in brands_dict[b] and m2 in brands_dict[b]:
                    scores_m1.append(brands_dict[b][m1])
                    scores_m2.append(brands_dict[b][m2])
            
            if len(scores_m1) > 1:
                tau = calculate_kendall_tau(scores_m1, scores_m2)
                avg_agreements.append(tau)
                
    for brand, b_data in brand_scores.items():
        scores = list(b_data['scores'].values())
        if len(scores) > 1:
            spread = max(scores) - min(scores)
            if spread > 15:
                high_disagreement.append({
                    'brand': brand,
                    'industry': b_data['industry'],
                    'scores': b_data['scores'],
                    'spread': spread
                })
                
    model_bias = {}
    model_totals = {m: {'sum': 0.0, 'count': 0} for m in all_models}
    
    for b_data in brand_scores.values():
        scores = list(b_data['scores'].values())
        if len(scores) > 0:
            mean_score = sum(scores) / len(scores)
            for m, s in b_data['scores'].items():
                model_totals[m]['sum'] += (s - mean_score)
                model_totals[m]['count'] += 1
                
    for m, totals in model_totals.items():
        if totals['count'] > 0:
            model_bias[m] = totals['sum'] / totals['count']
            
    avg_agreement = sum(avg_agreements) / len(avg_agreements) if avg_agreements else 0.0
    avg_agreement_scaled = (avg_agreement + 1) / 2 if avg_agreements else 0.0
    
    return {
        'date': run_date,
        'industries_evaluated': len(data_by_industry),
        'avg_agreement': avg_agreement_scaled,
        'high_disagreement': high_disagreement,
        'model_bias': model_bias
    }
