"""Oddech in Gazebo Harmonic with ROS 2 Jazzy: the flat, the robot spawned from the URDF, robot_state_publisher, the bridge.

    ros2 launch oddech_gazebo sim.launch.py
    ros2 launch oddech_gazebo sim.launch.py x:=4.2 y:=2.4 yaw:=0.0

Then drive with /cmd_vel (e.g. teleop_twist_keyboard) and raise the nose with /mast/cmd:
    ros2 topic pub --once /mast/cmd std_msgs/msg/Float64 "{data: 0.175}"     # nose at 1.10 m
"""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import AppendEnvironmentVariable, DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import Command, LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    gz_share = get_package_share_directory("oddech_gazebo")
    desc_share = get_package_share_directory("oddech_description")
    urdf = ParameterValue(Command(["xacro ", os.path.join(desc_share, "urdf", "oddech.urdf.xacro")]), value_type=str)
    arg = LaunchConfiguration
    return LaunchDescription([
        DeclareLaunchArgument("world", default_value="oddech_flat.sdf", description="world in oddech_gazebo/worlds (without a robot)"),
        DeclareLaunchArgument("x", default_value="6.6"), DeclareLaunchArgument("y", default_value="3.0"),
        DeclareLaunchArgument("yaw", default_value="3.14159", description="start heading, rad; the website's robot starts facing -x"),
        # the flat (model://oddech_flat) and the meshes (package://oddech_description) must be on Gazebo's resource path;
        # the packages' environment hooks do this after `source install/setup.bash`, these lines make the launch work either way
        AppendEnvironmentVariable("GZ_SIM_RESOURCE_PATH", os.path.join(gz_share, "models")),
        AppendEnvironmentVariable("GZ_SIM_RESOURCE_PATH", os.path.dirname(desc_share)),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(get_package_share_directory("ros_gz_sim"), "launch", "gz_sim.launch.py")),
            launch_arguments={"gz_args": ["-r ", PathJoinSubstitution([gz_share, "worlds", arg("world")])], "on_exit_shutdown": "true"}.items()),
        Node(package="robot_state_publisher", executable="robot_state_publisher", output="screen",
             parameters=[{"robot_description": urdf, "use_sim_time": True}]),
        Node(package="ros_gz_sim", executable="create", output="screen",
             arguments=["-name", "oddech", "-topic", "robot_description", "-x", arg("x"), "-y", arg("y"), "-z", "0.005", "-Y", arg("yaw")]),
        Node(package="ros_gz_bridge", executable="parameter_bridge", output="screen",
             parameters=[{"config_file": os.path.join(gz_share, "config", "ros_gz_bridge.yaml"), "use_sim_time": True}]),
    ])
