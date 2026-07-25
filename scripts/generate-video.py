import base64
import time
import sys
import argparse
from google import genai
from google.genai import types

def b64decode(b64_encoded_string: str) -> bytes:
  return base64.b64decode(b64_encoded_string.encode('utf-8'))

parser = argparse.ArgumentParser(description='Generate a Veo video for a report.')
parser.add_argument('--title', type=str, default='The rAsh Score Weekly: Tech Giants Dominate AI Share of Voice', help='Title of the report')
parser.add_argument('--article', type=str, default='', help='A short snippet or summary of the article to guide the video generation')
args = parser.parse_args()

# Assuming the user has ADC (Application Default Credentials) configured
# on Vertex AI. The project is rashscore and location is us-central1.
client = genai.Client(
    vertexai=True,
    project="rashscore",
    location="us-central1",
)

article_context = f" The video should visually represent the following topics: {args.article}" if args.article else ""
prompt = f"A cinematic, fast-paced futuristic intro for a weekly tech report titled '{args.title}'. The video shows glowing 3D AI holograms of global technology hubs, data streams flying across the screen, and sleek robotic elements.{article_context} The camera pans dynamically over a digital globe with glowing data nodes lighting up in neon blue and purple."



print(f"Generating video for prompt:\n{prompt}\n")

source = types.GenerateVideosSource(
    prompt=prompt,
)

config = types.GenerateVideosConfig(
    aspect_ratio="16:9",
    number_of_videos=1,
    duration_seconds=8,
    person_generation="allow_adult", # 'allow_adult' or 'dont_allow' are usually the accepted enum values for Veo
    # generate_audio=True, # Optional, if audio is needed
    resolution="720p",
)

try:
    # Generate the video generation request
    print("Sending request to Veo 3.1 Lite...")
    operation = client.models.generate_videos(
        model="veo-3.1-lite-generate-001", source=source, config=config
    )

    # Waiting for the video(s) to be generated
    while not operation.done:
        print("Video has not been generated yet. Check again in 10 seconds...")
        time.sleep(10)
        operation = client.operations.get(operation)

    response = operation.result
    if not response:
        print("Error occurred while generating video.")
        sys.exit(1)

    generated_videos = response.generated_videos
    if not generated_videos:
        print("No videos were generated.")
        sys.exit(1)

    print(f"Generated {len(generated_videos)} video(s).")
    
    # Save the output to a file
    video_bytes = generated_videos[0].video.video_bytes
    output_filename = "latest_report_intro.mp4"
    with open(output_filename, "wb") as f:
        f.write(video_bytes)
        
    print(f"Video successfully saved to {output_filename}")
    
except Exception as e:
    print(f"Failed to generate video: {e}")
    sys.exit(1)
