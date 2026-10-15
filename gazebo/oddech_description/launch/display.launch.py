"""Oddech in RViz, without Gazebo: the URDF, joint sliders (wheels and the four mast stages) and the RViz view.

    ros2 launch oddech_description display.launch.py
"""
from launch import LaunchDescription
from launch.substitutions import Command, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    share = FindPackageShare("oddech_description")
    urdf = ParameterValue(Command(["xacro ", PathJoinSubstitution([share, "urdf", "oddech.urdf.xacro"]), " gazebo:=false"]), value_type=str)
    return LaunchDescription([
        Node(package="robot_state_publisher", executable="robot_state_publisher", parameters=[{"robot_description": urdf}]),
        Node(package="joint_state_publisher_gui", executable="joint_state_publisher_gui"),
        Node(package="rviz2", executable="rviz2", arguments=["-d", PathJoinSubstitution([share, "rviz", "oddech.rviz"])]),
    ])
